# Notification System Design

---

## Stage 1

### REST API Design

Base URL: `http://localhost:3002`

All endpoints require the following header:
```
Content-Type: application/json
```

---

#### 1. Get All Notifications
**GET** `/notifications`

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "Placement",
      "message": "Google is hiring!",
      "studentID": "student-001",
      "isRead": false,
      "createdAt": "2026-05-11T07:54:55.275Z"
    }
  ]
}
```

---

#### 2. Get Notification by ID
**GET** `/notifications/:id`

Response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "Placement",
    "message": "Google is hiring!",
    "studentID": "student-001",
    "isRead": false,
    "createdAt": "2026-05-11T07:54:55.275Z"
  }
}
```

Error (404):
```json
{
  "success": false,
  "message": "Notification not found"
}
```

---

#### 3. Create Notification
**POST** `/notifications`

Request Body:
```json
{
  "type": "Placement",
  "message": "Google is hiring!",
  "studentID": "student-001"
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "Placement",
    "message": "Google is hiring!",
    "studentID": "student-001",
    "isRead": false,
    "createdAt": "2026-05-11T07:54:55.275Z"
  }
}
```

---

#### 4. Update Notification
**PUT** `/notifications/:id`

Request Body:
```json
{
  "message": "Google is hiring - updated!"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "Placement",
    "message": "Google is hiring - updated!",
    "studentID": "student-001",
    "isRead": false,
    "createdAt": "2026-05-11T07:54:55.275Z"
  }
}
```

---

#### 5. Mark Notification as Read
**PATCH** `/notifications/:id/read`

Response (200):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "Placement",
    "message": "Google is hiring!",
    "studentID": "student-001",
    "isRead": true,
    "createdAt": "2026-05-11T07:54:55.275Z"
  }
}
```

---

#### 6. Delete Notification
**DELETE** `/notifications/:id`

Response (200):
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

---

### Real-Time Notification Mechanism

For real-time delivery of notifications, **WebSockets** via **Socket.IO** is the recommended approach.

**How it works:**
1. When a student logs in, their client establishes a WebSocket connection to the server
2. The server maps the student's `studentID` to their socket connection
3. When a new notification is created for that student, the server emits an event directly to their socket
4. The client receives the event instantly without needing to poll

**Example server-side emit:**
```javascript
io.to(socketID).emit("new_notification", {
  id: "uuid",
  type: "Placement",
  message: "Google is hiring!",
  createdAt: "2026-05-11T07:54:55.275Z"
});
```

**Alternative:** Server-Sent Events (SSE) can also be used for one-way real-time updates from server to client, which is simpler to implement but does not support bidirectional communication.

---

## Stage 2

### Recommended Database: PostgreSQL

**Reasoning:**
- Notifications have a well-defined, consistent schema making a relational database a natural fit
- PostgreSQL supports JSONB columns for flexible metadata if needed in future
- Strong support for indexing, which is critical for querying by `studentID`, `isRead`, and `createdAt`
- ACID compliance ensures no notifications are lost or duplicated
- Mature support for pagination, sorting, and filtering at the query level

---

### DB Schema

```sql
CREATE TYPE notification_type AS ENUM ('Placement', 'Event', 'Result');

CREATE TABLE students (
  id          VARCHAR(50) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(100) UNIQUE NOT NULL,
  createdAt   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studentID         VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type              notification_type NOT NULL,
  message           TEXT NOT NULL,
  isRead            BOOLEAN DEFAULT FALSE,
  createdAt         TIMESTAMP DEFAULT NOW()
);
```

---

### Problems as Data Volume Increases

1. **Slow queries** — Querying unread notifications for a student across millions of rows without indexes becomes a full table scan
2. **High read load** — Notifications are fetched on every page load, hammering the DB
3. **Write bottlenecks** — Bulk notifications (e.g. notify all 50,000 students) create massive simultaneous inserts
4. **Storage growth** — Old notifications accumulate indefinitely, bloating the table
5. **Connection exhaustion** — Too many concurrent students querying at once can exhaust the DB connection pool

---

### Solutions

- Add composite indexes on `(studentID, isRead, createdAt)`
- Introduce a caching layer (Redis) for frequently accessed notifications
- Use a message queue (e.g. RabbitMQ, BullMQ) for bulk notification delivery
- Archive or soft-delete old notifications using a scheduled cron job
- Use connection pooling (e.g. PgBouncer) to manage concurrent DB connections

---

### SQL Queries

**Fetch all unread notifications for a student:**
```sql
SELECT * FROM notifications
WHERE studentID = 'student-001' AND isRead = FALSE
ORDER BY createdAt DESC;
```

**Create a notification:**
```sql
INSERT INTO notifications (studentID, type, message)
VALUES ('student-001', 'Placement', 'Google is hiring!');
```

**Mark a notification as read:**
```sql
UPDATE notifications
SET isRead = TRUE
WHERE id = 'uuid';
```

**Delete a notification:**
```sql
DELETE FROM notifications
WHERE id = 'uuid';
```

**Get all notifications for a student (paginated):**
```sql
SELECT * FROM notifications
WHERE studentID = 'student-001'
ORDER BY createdAt DESC
LIMIT 20 OFFSET 0;
```

---

## Stage 3

### Is the query accurate?

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

The query is **logically correct** in intent — it fetches unread notifications for a student ordered by recency. However it has performance problems at scale.

---

### Why is it slow?

1. **No index on `studentID` or `isRead`** — PostgreSQL performs a full sequential scan across all 5,000,000 rows
2. **`SELECT *`** — Fetches all columns including ones not needed, increasing I/O
3. **`ORDER BY createdAt DESC` without index** — Requires an in-memory sort of the filtered result set
4. **No pagination** — Returns all unread notifications at once, which could be thousands of rows

---

### What would you change?

**Step 1: Add a composite index**
```sql
CREATE INDEX idx_notifications_student_unread
ON notifications (studentID, isRead, createdAt DESC);
```

**Step 2: Select only needed columns**
```sql
SELECT id, type, message, createdAt FROM notifications
WHERE studentID = 1042 AND isRead = FALSE
ORDER BY createdAt DESC
LIMIT 20;
```

**Computational cost improvement:**
- Before: O(n) full table scan — scans all 5,000,000 rows
- After: O(log n) B-tree index lookup — jumps directly to matching rows

---

### Should you add indexes on every column?

**No, this is bad advice.** Here is why:

- Every index consumes additional disk space
- Every `INSERT`, `UPDATE`, and `DELETE` must update all indexes on the table, slowing down write operations significantly
- Indexes should only be added on columns that are frequently used in `WHERE`, `ORDER BY`, or `JOIN` clauses
- For a notifications table, the right indexes are on `studentID`, `isRead`, `createdAt`, and `type` — not every column

---

### Query to find all students who got a Placement notification in the last 7 days

```sql
SELECT DISTINCT studentID FROM notifications
WHERE type = 'Placement'
AND createdAt >= NOW() - INTERVAL '7 days';
```

---

## Stage 4

### Problem
Notifications are fetched on every page load for every student, overwhelming the database.

---

### Solution: Caching with Redis

Introduce a **Redis** caching layer between the API and the database.

**Strategy:**
1. On first request, fetch notifications from DB and store in Redis with the key `notifications:{studentID}`
2. On subsequent requests, serve directly from Redis cache
3. Invalidate (delete) the cache when a new notification is created or marked as read for that student

```javascript
// Pseudocode
async function getNotifications(studentID) {
  const cached = await redis.get(`notifications:${studentID}`);
  if (cached) return JSON.parse(cached);

  const data = await db.query(
    "SELECT * FROM notifications WHERE studentID = $1 ORDER BY createdAt DESC LIMIT 20",
    [studentID]
  );
  await redis.setEx(`notifications:${studentID}`, 60, JSON.stringify(data));
  return data;
}
```

---

### Additional Strategies

**Pagination** — Never load all notifications at once. Use `LIMIT` and `OFFSET` or cursor-based pagination to load in batches of 20.

**Read-through cache** — Cache is populated automatically on cache miss, reducing DB hits.

**Cache invalidation on write** — When a notification is created or read status changes, delete the relevant cache key so stale data is never served.

---

### Tradeoffs

| Strategy | Benefit | Tradeoff |
|---|---|---|
| Redis caching | Massively reduces DB read load | Stale data possible if cache not invalidated properly |
| Pagination | Reduces data transfer and memory usage | Requires frontend to handle paginated fetching |
| Cache invalidation on write | Keeps data fresh | Adds complexity; a write-heavy workload can negate caching benefits |
| TTL-based expiry | Simple to implement | Student may see slightly outdated notifications until TTL expires |

---

## Stage 5

### Shortcomings of the proposed implementation

```python
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        send_email(student_id, message)
        save_to_db(student_id, message)
        push_to_app(student_id, message)
```

1. **Synchronous loop** — Processing 50,000 students one by one is extremely slow. If each iteration takes 100ms, total time is over 1.5 hours
2. **No error handling** — If `send_email` fails for one student, the entire loop may crash and no subsequent students get notified
3. **Tightly coupled operations** — Email sending, DB saving, and push notification are all in the same blocking call with no retry logic
4. **No partial failure recovery** — If the process crashes at student 25,000, there is no way to resume from where it left off
5. **No rate limiting** — Sending 50,000 emails simultaneously will likely be rate-limited or blocked by the email provider

---

### Email failed for 200 students midway

Without a queue, those 200 students are simply missed with no way to identify or retry them. The solution is to log every failure with the `studentID` and requeue failed jobs for retry.

---

### Should saving to DB and sending email happen together?

**No.** They should be decoupled. Saving to DB confirms the notification exists. Sending the email is a side effect that can fail independently. If they are coupled, a failed email means the notification is never saved, which is worse. Save to DB first, always. Deliver asynchronously.

---

### Revised Pseudocode

```python
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        save_to_db(student_id, message)        # Save first, always
        enqueue_job("send_email", student_id, message)
        enqueue_job("push_to_app", student_id, message)

# Worker processes jobs from the queue concurrently
function worker():
    while true:
        job = dequeue_job()
        try:
            if job.type == "send_email":
                send_email(job.student_id, job.message)
            elif job.type == "push_to_app":
                push_to_app(job.student_id, job.message)
            mark_job_complete(job.id)
        except Exception as e:
            log_error(job.student_id, e)
            if job.retry_count < 3:
                requeue_job(job)               # Retry up to 3 times
            else:
                mark_job_failed(job.id)        # Dead letter queue
```

**Key improvements:**
- DB save happens synchronously and immediately — notification is never lost
- Email and push are offloaded to a job queue (e.g. BullMQ, RabbitMQ)
- Multiple workers process jobs concurrently — 50,000 jobs complete in minutes not hours
- Failed jobs are retried up to 3 times before being moved to a dead letter queue
- The process is resumable — if the server crashes, queued jobs are not lost

---

## Stage 6

### Approach: Priority Scoring with a Min-Heap

Each notification is scored based on two factors:
- **Type weight:** Placement = 3, Result = 2, Event = 1
- **Recency:** More recent notifications score higher using a normalized time decay

**Combined score formula:**
```
score = typeWeight * 1000 + recencyScore
```

Where `recencyScore` is the number of seconds since a reference point subtracted from a large number, so newer notifications have a higher score.

A **min-heap of size n** (default 10) is maintained. For each incoming notification:
- If the heap has fewer than n items, push directly
- If the new notification's score is greater than the heap's minimum, pop the minimum and push the new one

This gives O(log n) insertion per notification, making it efficient even as new notifications stream in.

---

### Maintaining Top 10 as New Notifications Arrive

The min-heap always holds exactly the top n notifications. When a new notification arrives:
1. Calculate its priority score
2. Compare with the root of the min-heap (the lowest priority among the current top n)
3. If the new score is higher, replace the root and re-heapify
4. This ensures the heap always contains the top n most important notifications in O(log n) time

---

### Stage 6 Code

See `notification_app_be/priority_inbox.js` for the full implementation.

```javascript
const axios = require("axios");
const { Log } = require("../logging_middleware/logger");

const TOKEN = "YOUR_TOKEN_HERE";
const BASE_URL = "http://4.224.186.213/evaluation-service/notifications";

// Type weights: Placement > Result > Event
const TYPE_WEIGHT = { Placement: 3, Result: 2, Event: 1 };

function getPriorityScore(notification) {
  const typeWeight = TYPE_WEIGHT[notification.Type] || 0;
  const timestamp = new Date(notification.Timestamp).getTime();
  const recencyScore = timestamp / 1000000;
  return typeWeight * 1000 + recencyScore;
}

// Min-heap implementation
class MinHeap {
  constructor(maxSize) {
    this.heap = [];
    this.maxSize = maxSize;
  }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  peek() { return this.heap[0]; }
  size() { return this.heap.length; }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].score <= this.heap[i].score) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l].score < this.heap[smallest].score) smallest = l;
      if (r < n && this.heap[r].score < this.heap[smallest].score) smallest = r;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

function getTopN(notifications, n = 10) {
  const heap = new MinHeap(n);
  for (const notif of notifications) {
    const score = getPriorityScore(notif);
    const item = { ...notif, score };
    if (heap.size() < n) {
      heap.push(item);
    } else if (score > heap.peek().score) {
      heap.pop();
      heap.push(item);
    }
  }
  return heap.heap.sort((a, b) => b.score - a.score);
}

async function main() {
  await Log("backend", "info", "service", "Fetching notifications for priority inbox");
  const res = await axios.get(BASE_URL, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const notifications = res.data.notifications;
  await Log("backend", "info", "service", `Fetched ${notifications.length} notifications`);

  const top10 = getTopN(notifications, 10);
  await Log("backend", "info", "service", "Top 10 priority notifications calculated");

  console.log("\n===== TOP 10 PRIORITY NOTIFICATIONS =====\n");
  top10.forEach((n, i) => {
    console.log(`${i + 1}. [${n.Type}] ${n.Message} | ${n.Timestamp} | Score: ${n.score.toFixed(2)}`);
  });
}

main();
```
