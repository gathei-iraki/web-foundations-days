# SnapShare Scaling Plan

## Assumptions

- SnapShare has 10 million registered users, and the user count stays constant during this estimate.
- 10% of registered users are active each day.
- Each active user uploads one photo and views 50 feed pages per day.
- Each original photo averages 2 MB and each generated thumbnail averages 50 KB (0.05 MB).
- Traffic is spread across 86,400 seconds for average-rate calculations.
- Peak traffic is estimated as five times the average traffic.
- Storage units are decimal (`1 TB = 1,000,000 MB`), and the estimate excludes replication, backups, database metadata, and deleted photos.

## Capacity estimates

### Daily active users

```text
10,000,000 registered users × 10% = 1,000,000 daily active users
```

SnapShare therefore has an estimated **1 million daily active users**.

### Photo uploads

```text
1,000,000 active users × 1 upload = 1,000,000 uploads per day
1,000,000 ÷ 86,400 ≈ 11.6 uploads per second on average
11.6 × 5 ≈ 57.9 uploads per second at peak
```

The system should handle about **12 uploads per second on average** and approximately **58 uploads per second at peak**.

### Feed views

```text
1,000,000 active users × 50 pages = 50,000,000 feed views per day
50,000,000 ÷ 86,400 ≈ 578.7 feed views per second on average
578.7 × 5 ≈ 2,893.5 feed views per second at peak
```

The system should handle about **579 feed views per second on average** and approximately **2,894 feed views per second at peak**.

### Photo storage per year

```text
Storage per upload = 2 MB original + 0.05 MB thumbnail = 2.05 MB
2.05 MB × 1,000,000 uploads per day = 2,050,000 MB per day
2,050,000 MB × 365 days = 748,250,000 MB per year
748,250,000 MB ÷ 1,000,000 = 748.25 TB per year
```

SnapShare adds approximately **748.25 TB of photo storage each year** before replication and backups. Of this total, original photos use about 730 TB and thumbnails use about 18.25 TB.

## Read-heavy or write-heavy?

SnapShare is read-heavy because it receives about 50 feed-page reads for every photo upload, with roughly 2,894 peak feed views per second compared with 58 peak uploads per second. The design should therefore prioritize low-latency reads by serving photo files through a CDN, caching popular feed data, and sending suitable database reads to a read replica, while still processing uploads and thumbnails asynchronously so writes do not slow down the feed.

## Photo storage choice

Photo files should not be stored inside the relational database because large binary values would make the database, its indexes, backups, and replication unnecessarily large and expensive. The originals and thumbnails should instead be placed in scalable object storage, while the database stores only metadata such as the owner, object key, caption, dimensions, and upload time.

## Architecture

```text
                                  +-------------------+
                                  |        CDN        |
                                  +---------+---------+
                                            |
                                            | cached photos and thumbnails
                                            v
+--------+       +---------------+    +----------------+
| Client |------>| Load Balancer |--->|  App Servers   |
+---+----+       +---------------+    +---+---+----+---+
    ^                                      |   |    |
    |                                      |   |    +---------> +-------+
    |                                      |   |                | Cache |
    |                                      |   |                +-------+
    |                                      |   v
    |                                      | +------------------+
    |                                      | | Primary Database |
    |                                      | +--------+---------+
    |                                      |          |
    |                                      |          | replication
    |                                      |          v
    |                                      | +------------------+
    |                                      | |   Read Replica   |
    |                                      | +------------------+
    |                                      |
    | upload/download                      v
    +----------------------------> +----------------+
                                   | Object Storage |
                                   +-------+--------+
                                           ^
                                           | stores thumbnail
                                   +-------+--------+
                                   |     Worker     |
                                   +-------+--------+
                                           ^
                                           | thumbnail job
                                      +----+----+
                                      |  Queue  |
                                      +----+----+
                                           ^
                                           |
                                      App Servers
```

## Component responsibilities

- **Client:** Lets users upload photos and request feed pages and image files.
- **CDN:** Caches photos and thumbnails close to users to reduce latency and object-storage traffic.
- **Load balancer:** Distributes incoming API requests across healthy app servers so no single server is overloaded.
- **App servers:** Run authentication, feed, upload, and metadata logic while remaining stateless enough to scale horizontally.
- **Cache:** Keeps frequently requested feed data and metadata in memory to reduce database reads and response time.
- **Primary database:** Stores authoritative user, follow, photo-metadata, and feed records and accepts database writes.
- **Read replica:** Handles suitable read queries so heavy feed traffic does not overwhelm the primary database.
- **Object storage:** Stores durable, scalable original photo and thumbnail files outside the database.
- **Queue:** Buffers thumbnail jobs so upload requests do not wait for image processing and traffic bursts can be absorbed.
- **Worker:** Consumes queued jobs, creates thumbnails, saves them to object storage, and updates their metadata.

## Photo upload flow

1. The client sends an authenticated upload request containing the photo's metadata to the load balancer.
2. The load balancer routes the request to an available app server.
3. The app server validates the user, file type, and file size, then creates a pending photo record in the primary database.
4. The app server returns a short-lived signed upload URL so the client can send the large original file directly to object storage without passing its bytes through an app server.
5. The client uploads the original photo to object storage using that signed URL.
6. The client confirms completion, and the app server marks the original as uploaded and places a thumbnail job on the queue.
7. A worker takes the job from the queue, downloads the original from object storage, and creates the 50 KB thumbnail.
8. The worker uploads the thumbnail to object storage and updates the photo record in the primary database to mark it ready.
9. The app invalidates or refreshes affected cached feeds, and the CDN retrieves and caches the new files when users first request them.

## Trade-offs

- **Asynchronous thumbnails:** A queue makes uploads respond faster and absorbs bursts, but a newly uploaded photo may temporarily appear without a thumbnail, so the UI needs a processing state and the worker needs retry and dead-letter handling.
- **Cached feeds:** Caching lowers latency and database load, but users may briefly see stale feeds; shorter expiry times improve freshness at the cost of more cache misses and database work.
- **Read replicas:** Replicas increase read capacity and protect the primary database, but replication lag can cause a user not to see a new photo immediately when a read is served from a replica.
- **Direct-to-object-storage uploads:** Signed uploads remove large files from app-server traffic and reduce scaling costs, but they add a multi-step client flow and require careful URL expiry, permissions, validation, and abandoned-upload cleanup.
