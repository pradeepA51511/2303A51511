# Campus Notifications Microservice Design

## Stage 1 – REST API Design
**Endpoints:**
1. `GET /api/v1/notifications`
   - **Description**: Fetch all notifications for a logged-in user.
   - **Headers**: `Authorization: Bearer <token>`
   - **Response (200)**: `{"notifications": [ ... ]}`
2. `POST /api/v1/notifications`
   - **Description**: Create a new notification (Admin/System only).
   - **Request**: `{"type": "Result", "message": "...", "studentId": 123}`
   - **Response (201)**: `{"message": "Notification created"}`
3. `PUT /api/v1/notifications/:id/read`
   - **Description**: Mark a notification as read.
   - **Response (200)**: `{"message": "Marked as read"}`

**Real-time Notifications:**
- Use **Server-Sent Events (SSE)** or **WebSockets** for real-time delivery of notifications to logged-in users. WebSockets are preferred for bi-directional needs, but SSE is perfectly fine for one-way notifications.

## Stage 2 – Persistent Storage
**Database Choice:** PostgreSQL (Relational DB)
- **Why?** Relational structure is great for mapping `Users` to `Notifications` through a `UserNotifications` join table or `studentID` foreign key. It ensures ACID compliance.
**Schema:**
- `Notifications`: `ID` (UUID, PK), `Type` (Enum), `Message` (Text), `CreatedAt` (Timestamp).
- `UserNotifications`: `NotificationID` (UUID, FK), `StudentID` (Int, FK), `IsRead` (Boolean, Default: false).
**Problems at Scale:** Large volume of writes and slow read queries as the table grows.
**Solutions:** Archiving old notifications, Read Replicas for scaling read traffic.

## Stage 3 – Query Optimization
**Original Query:** `SELECT * FROM notifications WHERE studentID = 1042 AND isRead = false ORDER BY createdAt DESC;`
- **Is it accurate?** Yes, but slow on large datasets without indexes.
- **Changes:** Add a composite index on `(studentID, isRead, createdAt DESC)`.
- **Computation cost:** Creating the index adds a slight write penalty, but O(log N) or better read performance.
- **Teammate's suggestion:** Adding indexes on every column is bad. It drastically degrades write performance and increases storage space unnecessarily.
- **Query for last 7 days:**
  `SELECT DISTINCT studentID FROM notifications WHERE notificationType = 'Placement' AND createdAt >= NOW() - INTERVAL '7 days';`

## Stage 4 – Performance & Caching
**Solution:** Implement a caching layer using **Redis**.
- **Strategy:** Cache unread notifications for active users with a TTL (e.g., 5-10 minutes).
- **Tradeoffs:**
  - *Pros:* Massive reduction in DB read queries, fast response times.
  - *Cons:* Stale data possibility (cache invalidation complexities), increased infrastructure cost. Cache invalidation must happen on marking as read.

## Stage 5 – Bulk Notifications
**Shortcomings observed:**
- Sending emails inside a synchronous loop blocks the thread.
- If it fails midway, we don't know which succeeded or failed without complex state management.
- DB inserts within the loop create high DB load.
**Redesign for Reliability:**
- Use an asynchronous Message Queue (e.g., RabbitMQ, Kafka, AWS SQS).
- Should DB save and Email happen together? No. Saving to the DB should be fast and reliable. Email sending is an external API call and can fail/retry.
**Revised Pseudocode:**
```python
def notify_all(student_ids: array, message: string):
    # 1. Bulk insert to DB
    bulk_insert_to_db(student_ids, message)
    # 2. Publish to Queue
    publish_to_queue({ "student_ids": student_ids, "message": message })

# In Background Worker:
def process_email_queue(job):
    for chunk in chunked(job.student_ids, 100):
        send_email_batch(chunk, job.message)
```

## Stage 6 – Priority Inbox
*Implemented in the Backend application code.* Priorities are calculated dynamically using weights (`Placement`=3, `Result`=2, `Event`=1) and recency score.
