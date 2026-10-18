# TicketHub System Design

## 1. Requirements

### Functional requirements

- Users can register, sign in, browse and search upcoming events, and open an event page.
- Users can view a venue's seats and see whether each seat is available, temporarily held, or sold.
- An authenticated user can place one or more available seats on a short hold (for example, five minutes).
- The user can pay for a valid hold. After successful payment, TicketHub creates a confirmed order and tickets.
- Users can list and view their purchased tickets.
- Expired holds are released automatically, and failed or repeated payment requests do not create duplicate orders.
- Administrators can create events and load their seat inventory, although the public API below focuses on the buyer journey.

### Non-functional requirements

- **Speed:** Cached event pages should usually respond within 200 ms, seat availability within 500 ms, and hold requests within 1 second. Payment may take longer because it calls a payment provider.
- **Correctness:** A seat must never be sold twice. Orders, holds, and payments must have auditable states, money must use an exact decimal or integer-cent type, and retries must be idempotent.
- **Fairness:** During a major sale, buyers enter a first-in-first-out waiting room. Each admitted buyer receives a short, signed purchase window, all buyers use the same hold duration, and per-account/request limits reduce bots and queue jumping.
- **Availability and resilience:** Browsing should remain available if a worker or one application instance fails. The buying path should reject or queue excess work instead of overloading the inventory database.
- **Security:** All traffic uses TLS; passwords are hashed; authorization protects holds, orders, and tickets; payment card details are handled by a compliant payment provider rather than stored by TicketHub.
- **Scalability and observability:** Stateless services scale horizontally. Metrics and alerts cover latency, error rate, queue depth, database locks, hold expiry, payment failures, and attempted duplicate sales.

## 2. Traffic and capacity estimates

### Assumptions

- TicketHub has 2,000,000 registered users.
- A normal day has 50,000 visitors, each viewing 10 pages, and 5,000 completed ticket sales.
- Daily averages divide activity evenly across 86,400 seconds. A normal busy-hour peak is estimated at five times the daily average.
- For the big sale, 200,000 buyers arrive during the same 10 minutes (600 seconds) for 20,000 seats.
- A big-sale buyer makes about four dynamic API requests: join/check the queue, load seats, request a hold, and start payment. Static assets are served by the CDN and are excluded.

### Normal traffic

```text
Page views/day = 50,000 visitors x 10 pages = 500,000
Average page views/second = 500,000 / 86,400 = 5.8
Estimated busy-hour page views/second = 5.8 x 5 = 29

Ticket sales/second = 5,000 / 86,400 = 0.058
Estimated busy-hour sales/second = 0.058 x 5 = 0.29
```

TicketHub therefore handles about **6 page views/second and 0.06 sales/second on average**, with an ordinary peak of roughly **29 page views/second and 0.29 sales/second** under the stated five-times assumption.

### Big-sale peak

```text
Arriving buyers/second = 200,000 / 600 = 333
Dynamic requests/second = 200,000 x 4 / 600 = 1,333
Maximum seats sold/second if spread evenly = 20,000 / 600 = 33.3
Demand per available seat = 200,000 / 20,000 = 10 buyers
```

The sale brings about **333 new buyers/second**, approximately **1,333 dynamic requests/second**, and up to **33 completed seat sales/second** if purchases are evenly spread. Arrivals are about **57 times** normal average page traffic and **11 times** the estimated normal page peak. The possible write rate is hundreds of times the normal average sales rate, and demand is ten times supply. In reality the first seconds may be burstier, so the waiting room deliberately limits admission to a tested safe rate rather than letting all 200,000 buyers contend for database locks.

## 3. API design

All endpoints use HTTPS and JSON. Protected endpoints obtain the user from an access token. Mutating requests accept an `Idempotency-Key` header so a retry returns the original result instead of repeating the operation.

| Method and path | Purpose | Important responses |
| --- | --- | --- |
| `GET /events?query=&date=&cursor=` | Browse or search published events with pagination. | `200 OK` |
| `GET /events/{eventId}` | View event details, venue, date, and price ranges. | `200 OK`, `404 Not Found` |
| `GET /events/{eventId}/seats` | View the seat map and current availability. Availability may be briefly cached and is rechecked when holding. | `200 OK` |
| `POST /events/{eventId}/holds` | Atomically hold requested `seatIds` for the signed-in user; returns `holdId` and `expiresAt`. | `201 Created`, `409 Conflict` if unavailable, `429 Too Many Requests` |
| `POST /orders` | Create a pending order from a valid `holdId` owned by the user. | `201 Created`, `409 Conflict` for an invalid/expired hold |
| `POST /orders/{orderId}/payments` | Start or confirm payment through the payment provider. Successful processing confirms the order and seats. | `200 OK`, `202 Accepted`, `402 Payment Required` |
| `GET /me/tickets?cursor=` | List the authenticated user's confirmed tickets. | `200 OK`, `401 Unauthorized` |
| `GET /me/tickets/{ticketId}` | View one ticket, including its event and seat. | `200 OK`, `403 Forbidden`, `404 Not Found` |

For the big sale, `POST /events/{eventId}/queue` can issue a FIFO queue token, and the hold endpoint accepts requests only when that signed token has been admitted. The queue position is not a promise of a seat; the database remains the final authority.

## 4. Data model

| Table | Important columns and constraints |
| --- | --- |
| `users` | `id` PK, `email` UNIQUE NOT NULL, `password_hash` NOT NULL, `created_at` |
| `events` | `id` PK, `name`, `venue`, `starts_at`, `sale_starts_at`, `status`, `created_at` |
| `seats` | `id` PK, `event_id` FK -> `events.id`, `section`, `row_label`, `seat_number`, `price_cents`, `status` (`AVAILABLE`, `HELD`, `SOLD`), `held_by_user_id` FK nullable, `hold_token` nullable, `hold_expires_at` nullable, UNIQUE (`event_id`, `section`, `row_label`, `seat_number`) |
| `orders` | `id` PK, `user_id` FK -> `users.id`, `hold_token`, `status` (`PENDING`, `PAID`, `FAILED`, `EXPIRED`), `total_cents`, `idempotency_key`, `created_at`, UNIQUE (`user_id`, `idempotency_key`) |
| `order_items` | `id` PK, `order_id` FK -> `orders.id`, `seat_id` FK -> `seats.id`, `price_cents`, UNIQUE (`seat_id`) |
| `payments` | `id` PK, `order_id` FK -> `orders.id`, `provider_reference` UNIQUE, `status`, `amount_cents`, `created_at` |
| `tickets` | `id` PK, `order_item_id` FK UNIQUE -> `order_items.id`, `ticket_code` UNIQUE, `issued_at` |

One user has many orders; one event has many seats; one order has many order items; and each order item refers to exactly one seat. A paid order item produces one ticket. Indexes on `events(starts_at)`, `seats(event_id, status)`, `orders(user_id, created_at)`, and `tickets(ticket_code)` support the main queries.

### Preventing double-booking

The seat read endpoint is only a convenient view; a green seat on a screen is not a guarantee. The hold transaction is the point at which availability is decided:

```sql
BEGIN;
SELECT id, status, hold_expires_at
FROM seats
WHERE event_id = :event_id AND id IN (:seat_ids)
FOR UPDATE;

-- Continue only if every seat is AVAILABLE, or its old hold has expired.
UPDATE seats
SET status = 'HELD',
    held_by_user_id = :user_id,
    hold_token = :hold_token,
    hold_expires_at = :expires_at
WHERE id IN (:seat_ids);
COMMIT;
```

`SELECT ... FOR UPDATE` locks those seat rows until the transaction commits. If Alice and Bob request the same seat, one transaction obtains the lock first. The other waits, then rereads the committed `HELD` state and receives `409 Conflict`. All seats in a multi-seat request are checked and updated in one transaction, so the request succeeds completely or not at all.

On payment confirmation, another transaction locks the order and its seats, verifies the hold token, owner, and expiry, inserts `order_items`, changes the seats to `SOLD`, and changes the order to `PAID`. The unique constraint on `order_items.seat_id` is a final database-level safeguard: even if application logic has a bug or two payment callbacks race, the database rejects a second sale. Idempotency keys and the unique payment-provider reference make client retries and duplicate callbacks safe. A background worker releases expired holds, but a new hold transaction may also treat an expired hold as available, so correctness does not depend on the worker running at the exact expiry time.

## 5. Architecture

```text
                           +--------------------+
                           | CDN + static assets|
                           +----------+---------+
                                      |
+--------+     +---------------+      v       +------------------+
| Browser|---->| WAF / rate    |------------->| Load balancer    |
+--------+     | limiter       |              +----+-------------+
               +-------+-------+                   |
                       |                           v
                       | big sale          +------------------+
                       +------------------>| Waiting-room     |
                                          | service          |
                                          +--------+---------+
                                                   | admitted token
                                                   v
 +--------------+       +-------+          +------------------+
 | Search index |<------| Event |<---------| Stateless API    |
 +--------------+       | cache |          | servers          |
                        +-------+          +--+------+-----+---+
                                              |      |     |
                    authoritative seat writes |      |     +------> Payment provider
                                              v      v
                                     +----------+  +-------------+
                                     | Primary  |  | Message     |
                                     | SQL DB   |  | queue       |
                                     +----+-----+  +------+------+ 
                                          |               |
                                          | replication   v
                                          v        +-------------+
                                     +----------+  | Workers     |
                                     | Read     |  | expiry/email|
                                     | replicas |  +-------------+
                                     +----------+
```

- **CDN** serves JavaScript, CSS, images, and cacheable event content close to users, removing most static traffic from the application.
- **WAF/rate limiter** blocks abusive traffic and enforces per-IP and per-account limits.
- **Waiting-room service** places the big-sale surge in a durable FIFO queue and admits buyers at the rate the purchase path has been load-tested to sustain. Signed, short-lived tokens prevent bypassing it.
- **Load balancer and stateless API servers** spread admitted requests across healthy instances. Autoscaling adds instances for browsing and API load.
- **Event cache and search index** handle read-heavy browsing without repeatedly querying the transactional database. Seat availability can be cached very briefly, but holds always go to the primary database.
- **Primary SQL database** is the single source of truth for seats, holds, orders, and payments. Transactions, row locks, and unique constraints protect inventory correctness. It should use high availability with a standby and partition or index seats by event.
- **Read replicas** serve appropriate event, account, and ticket reads. Inventory writes and any read requiring immediate consistency stay on the primary.
- **Message queue and workers** absorb non-critical jobs such as releasing holds, sending confirmations, and issuing ticket files. Retries and a dead-letter queue prevent temporary failures from losing work.
- **Payment provider** processes card details and sends signed callbacks; TicketHub verifies each callback and handles it idempotently.

During the big sale, the CDN and cache absorb public event-page reads, rate limiting reduces bot traffic, and the waiting room turns a sharp 200,000-person spike into a controlled stream. More API servers can be added horizontally, while admission control keeps the non-scalable critical section—short seat-locking transactions—within database capacity. If demand exceeds capacity, buyers wait rather than causing timeouts that invite retries and make the overload worse.

## 6. Trade-offs

- **Strong consistency versus maximum throughput:** Row locks and primary-database transactions add latency and limit how far purchasing can scale, but they guarantee that a scarce seat is sold once. TicketHub accepts this cost for checkout while using caching and replicas only where slightly stale reads are safe.
- **Waiting room versus immediate access:** A queue protects the system and makes admission fairer, but buyers must wait and an admitted buyer can still find that tickets have sold out. Showing position, status, and clear expiry times improves that experience.
- **Temporary holds versus inventory use:** A five-minute hold gives a buyer time to pay, but abandoned carts temporarily hide seats from others. Shorter holds improve availability but can expire during payment; the chosen duration should be measured and tuned, with a limited payment grace rule if needed.
- **Cached availability versus freshness:** A short cache makes the seat map fast under heavy reads, but it can display a seat that another buyer just held. The UI labels availability as provisional and the transactional hold endpoint returns the authoritative answer.
