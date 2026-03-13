# Precision Receipt System (DDS) - Hardware Sizing Document

**Document Version:** 1.0
**Date:** March 9, 2026
**Classification:** Confidential
**Prepared For:** Meezan Bank Limited
**System:** Digital Deposit Slip (DDS) / Precision Receipt System

---

## 1. Executive Summary

This document provides hardware sizing recommendations for the production deployment of Meezan Bank's Digital Deposit Slip (DDS) system. Sizing is based on:

- **1,000+ concurrent tellers** across ~900 branches
- **50,000 - 200,000 transactions/day** at full capacity
- **On-premises data center** deployment (SBP compliance)
- **HA + DR (Active-Passive)** architecture

The system comprises 6 core tiers: Application (API), Messaging (WhatsApp/SMS), Database (PostgreSQL), Cache (Redis), Web/Reverse Proxy (Nginx), and Monitoring/Logging.

---

## 2. Capacity Planning Assumptions

### 2.1 Transaction Profile

| Parameter | Value | Notes |
|-----------|-------|-------|
| Peak daily transactions | 200,000 | Full nationwide rollout |
| Average daily transactions | 100,000 | Steady-state estimate |
| Peak hour factor | 30% of daily volume | 10am-12pm banking rush |
| Peak hour transactions | 60,000 | 200K x 30% |
| Peak TPS (transactions/sec) | ~17 TPS | 60,000 / 3,600 sec |
| Burst TPS (5-min spike) | ~50 TPS | 3x average peak |
| Average transaction size | ~5 KB (API payload) | JSON request + response |
| Cheque OCR transactions | ~10% of total | Image upload + processing |

### 2.2 User Profile

| Parameter | Value | Notes |
|-----------|-------|-------|
| Total teller accounts | 3,000+ | Multiple tellers per branch |
| Concurrent teller sessions | 1,000 - 1,500 | Peak hours |
| WhatsApp concurrent sessions | 5,000 - 10,000 | Customer-initiated DRIDs |
| SMS concurrent sessions | 2,000 - 5,000 | Parallel channel |
| Average session duration | 15 min (teller), 5 min (customer) | |
| API calls per transaction | ~8 calls | Create DRID, retrieve, verify, complete, receipt, notify x2, audit |

### 2.3 Data Growth Projections

| Entity | Daily Growth | Monthly Growth | Yearly Growth |
|--------|-------------|----------------|---------------|
| Transactions | 200,000 rows | 6M rows | 72M rows |
| Digital Deposit Slips | 200,000 rows | 6M rows | 72M rows |
| Receipts | 200,000 rows | 6M rows | 72M rows |
| Notifications | 400,000 rows | 12M rows | 144M rows |
| Audit Logs | 1,600,000 rows | 48M rows | 576M rows |
| **Total DB growth/year** | | | **~936M rows** |
| **Storage growth/year** | ~2 GB/day | ~60 GB/month | **~720 GB/year** |

### 2.4 Data Retention

| Data Type | Retention | Regulation |
|-----------|-----------|------------|
| Transaction records | 10 years | SBP AML/CFT |
| Audit logs | 7 years | SBP compliance |
| Receipts + signatures | 10 years | Legal requirement |
| Session data | 24 hours | Operational |
| Expired DRIDs | 90 days | Operational + audit |
| Cheque images | 7 years | DMS archive |

---

## 3. Architecture Overview

```
                    ┌─────────────────────────────────────────────┐
                    │              LOAD BALANCER (F5/HAProxy)     │
                    │         VIP: dds.meezanbank.internal        │
                    │              TLS Termination                │
                    └──────┬────────────┬────────────┬────────────┘
                           │            │            │
                    ┌──────▼──┐  ┌──────▼──┐  ┌─────▼───┐
                    │ Nginx-1 │  │ Nginx-2 │  │ Nginx-3 │  Web Tier
                    │ (Active)│  │ (Active)│  │(Standby)│  (Reverse Proxy)
                    └──┬──┬───┘  └──┬──┬───┘  └─────────┘
                       │  │        │  │
          ┌────────────┘  │   ┌────┘  │
          ▼               ▼   ▼       ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │  API-1     │  │  API-2     │  │  API-3     │   App Tier
   │  FastAPI   │  │  FastAPI   │  │  FastAPI   │   (Backend)
   │  + Uvicorn │  │  + Uvicorn │  │  + Uvicorn │
   └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
         │               │               │
   ┌─────▼──────┐  ┌─────▼──────┐
   │  MSG-1     │  │  MSG-2     │        Messaging Tier
   │  WhatsApp/ │  │  WhatsApp/ │        (Twilio Webhooks)
   │  SMS Server│  │  SMS Server│
   └─────┬──────┘  └─────┬──────┘
         │               │
         └───────┬───────┘
                 │
   ┌─────────────▼──────────────┐
   │    PostgreSQL Cluster      │        Database Tier
   │  Primary ──► Streaming     │
   │             Replica (x2)   │
   └─────────────┬──────────────┘
                 │
   ┌─────────────▼──────────────┐
   │    Redis Sentinel Cluster  │        Cache Tier
   │  Master + 2 Replicas      │
   │  + 3 Sentinels            │
   └────────────────────────────┘
```

---

## 4. Hardware Sizing - Primary Data Center

### 4.1 Application Tier (Backend API Servers)

These servers run the FastAPI backend with Uvicorn workers handling DRID lifecycle, AML checks, receipt generation, and digital signature operations.

**Sizing Rationale:**
- Each Uvicorn worker handles ~100 concurrent connections
- RSA-2048 signing is CPU-intensive (~5ms per operation)
- AML rule evaluation requires DB queries (I/O bound)
- Target: Handle 50 TPS burst with <200ms P99 latency

| Spec | Per Server | Qty | Total |
|------|-----------|-----|-------|
| **Server Model** | 1U Rack Server (Dell R660 / HPE DL360 Gen11) | **3** | 3 servers |
| **CPU** | 2x Intel Xeon Gold 6438Y+ (32C/64T, 2.0GHz) | 3 | 192 cores / 384 threads |
| **RAM** | 128 GB DDR5 ECC (8x 16GB) | 3 | 384 GB |
| **Storage** | 2x 480 GB SSD (RAID-1, OS + App) | 3 | 2.88 TB raw |
| **NIC** | 2x 10 GbE (bonded, redundant) | 3 | 6 ports |
| **OS** | RHEL 9 / Rocky Linux 9 | | |
| **Runtime** | Python 3.11 + Uvicorn (8 workers/server) | | 24 workers total |

**Configuration per Server:**
```
Uvicorn workers:     8 (2x CPU cores guideline for I/O bound)
Max connections:     800 per server (100 per worker)
DB pool per server:  40 connections (5 per worker)
Total DB pool:       120 connections (across 3 servers)
Memory per worker:   ~2 GB (FastAPI + SQLAlchemy + crypto libs)
```

**Scaling Notes:**
- Horizontal scale: Add servers behind load balancer
- At 50 TPS burst, 3 servers provide 2.4x headroom (120 TPS theoretical)
- If cheque OCR moves on-prem (Tesseract/PaddleOCR), add GPU nodes (see Section 4.8)

---

### 4.2 Messaging Tier (WhatsApp/SMS Webhook Servers)

Handles Twilio webhook ingestion, conversation state machines, and TwiML response generation.

**Sizing Rationale:**
- WhatsApp/SMS sessions are stateful (in-memory state machine)
- Each session: ~50 KB memory footprint
- Target: 15,000 concurrent sessions with headroom
- Must persist sessions to Redis (current gap) for HA

| Spec | Per Server | Qty | Total |
|------|-----------|-----|-------|
| **Server Model** | 1U Rack Server | **2** | 2 servers |
| **CPU** | 2x Intel Xeon Silver 4416+ (20C/40T, 2.0GHz) | 2 | 80 cores / 160 threads |
| **RAM** | 64 GB DDR5 ECC | 2 | 128 GB |
| **Storage** | 2x 480 GB SSD (RAID-1) | 2 | 1.92 TB raw |
| **NIC** | 2x 10 GbE (bonded) | 2 | 4 ports |

**Configuration per Server:**
```
Uvicorn workers:           4
Max concurrent sessions:   10,000 per server
Session memory:            ~500 MB (10K x 50KB)
Twilio webhook timeout:    15 seconds (SLA)
Session timeout:           30 minutes (auto-expire)
```

**Critical Prerequisite:**
- Sessions MUST be migrated from in-memory dict to Redis for HA failover
- Without Redis sessions, server restart loses all active WhatsApp conversations

---

### 4.3 Database Tier (PostgreSQL Cluster)

Primary data store for all transactional, customer, and audit data.

**Sizing Rationale:**
- 936M rows/year growth across all tables
- ~720 GB/year data growth (with indexes)
- 7-10 year retention = up to 7.2 TB data
- Read replicas offload reporting queries
- WAL archiving for point-in-time recovery

| Spec | Primary | Read Replica | Qty | Total |
|------|---------|-------------|-----|-------|
| **Server Model** | 2U Rack Server (Dell R760 / HPE DL380 Gen11) | Same | **1 + 2** | 3 servers |
| **CPU** | 2x Intel Xeon Gold 6448Y (32C/64T, 2.1GHz) | Same | 3 | 192 cores |
| **RAM** | 256 GB DDR5 ECC | 128 GB | | 512 GB |
| **Storage - Data** | 4x 3.84 TB NVMe SSD (RAID-10) | 4x 3.84 TB NVMe SSD (RAID-10) | 3 | 23 TB raw / 11.5 TB usable |
| **Storage - WAL** | 2x 1.92 TB NVMe SSD (RAID-1) | -- | 1 | 1.92 TB usable |
| **Storage - Backup** | Connected to SAN/NAS | -- | | See Section 4.7 |
| **NIC** | 2x 25 GbE (bonded) | 2x 10 GbE | 3 | |

**PostgreSQL Configuration:**
```ini
# Memory
shared_buffers          = 64 GB        # 25% of 256 GB RAM
effective_cache_size    = 192 GB       # 75% of RAM
work_mem                = 256 MB       # Per sort/hash operation
maintenance_work_mem    = 4 GB         # For VACUUM, CREATE INDEX

# Connections
max_connections         = 300          # 120 app + 40 messaging + reserve
connection_pooling      = PgBouncer    # External pooler recommended

# WAL & Replication
wal_level               = replica
max_wal_senders         = 5
synchronous_commit      = on           # Data integrity for banking
wal_compression         = on
archive_mode            = on           # PITR backups

# Performance
random_page_cost        = 1.1          # NVMe SSD
effective_io_concurrency = 200         # NVMe parallel I/O
max_parallel_workers_per_gather = 4
checkpoint_completion_target = 0.9
```

**PgBouncer (Connection Pooler):**
- Deploy on each app server or as separate lightweight instance
- Pool mode: `transaction` (release connection after each query)
- Max client connections: 1,000
- Max server connections to PG: 200

**Partitioning Strategy (Recommended):**
```sql
-- Partition large tables by month for query performance + archival
CREATE TABLE transactions (...) PARTITION BY RANGE (created_at);
CREATE TABLE audit_logs (...) PARTITION BY RANGE (created_at);
CREATE TABLE notifications (...) PARTITION BY RANGE (created_at);
CREATE TABLE digital_deposit_slips (...) PARTITION BY RANGE (created_at);
```

---

### 4.4 Cache Tier (Redis Sentinel Cluster)

Session caching, rate limiting, OTP storage, and WhatsApp/SMS session persistence.

**Sizing Rationale:**
- 15,000 concurrent sessions x 50 KB = ~750 MB session data
- Rate limiting counters: ~100 MB
- OTP store: ~50 MB
- Application cache: ~500 MB
- Total working set: ~1.5 GB (Redis is in-memory, size RAM accordingly)

| Spec | Per Node | Qty | Total |
|------|----------|-----|-------|
| **Server Model** | 1U Rack / VM | **3** (1 master + 2 replicas) | 3 nodes |
| **CPU** | 8 cores (Intel Xeon / AMD EPYC) | 3 | 24 cores |
| **RAM** | 32 GB DDR5 ECC | 3 | 96 GB |
| **Storage** | 2x 480 GB SSD (RAID-1) | 3 | 2.88 TB raw |
| **NIC** | 2x 10 GbE | 3 | |

**Additionally: 3x Redis Sentinel processes** (can co-locate on app servers):
- Monitors master health
- Automatic failover to replica
- Client redirection

**Redis Configuration:**
```conf
maxmemory              8gb
maxmemory-policy       allkeys-lru
appendonly             yes          # AOF for durability
appendfsync            everysec     # Balance durability + performance
save                   900 1        # RDB snapshot every 15 min
tcp-backlog            511
timeout                300          # 5-min idle timeout
```

---

### 4.5 Web Tier (Nginx Reverse Proxy / Load Balancer)

TLS termination, static file serving, reverse proxy to backend services, and rate limiting.

| Spec | Per Server | Qty | Total |
|------|-----------|-----|-------|
| **Server Model** | 1U Rack / VM | **2** (Active-Active) | 2 servers |
| **CPU** | 16 cores | 2 | 32 cores |
| **RAM** | 32 GB DDR5 | 2 | 64 GB |
| **Storage** | 2x 240 GB SSD (RAID-1) | 2 | 960 GB raw |
| **NIC** | 2x 25 GbE (bonded) | 2 | |

**Nginx Configuration:**
```nginx
worker_processes       auto;          # = CPU cores
worker_connections     4096;
keepalive_timeout      65;

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=webhook:10m rate=100r/s;

# SSL/TLS
ssl_protocols          TLSv1.2 TLSv1.3;
ssl_ciphers            HIGH:!aNULL:!MD5;
ssl_session_cache      shared:SSL:50m;
ssl_session_timeout    1d;

# Upstream pools
upstream api_backend {
    least_conn;
    server api-1:8000 weight=1;
    server api-2:8000 weight=1;
    server api-3:8000 weight=1;
}

upstream messaging_backend {
    least_conn;
    server msg-1:8000 weight=1;
    server msg-2:8000 weight=1;
}
```

**External Load Balancer:**
- F5 BIG-IP or HAProxy in front of Nginx for VIP management
- Health checks: HTTP GET /health every 10 seconds
- Session persistence: Not required (JWT is stateless)

---

### 4.6 Monitoring & Logging Tier

Centralized logging, metrics, alerting, and APM.

| Spec | Per Server | Qty | Total |
|------|-----------|-----|-------|
| **Server Model** | 2U Rack Server | **2** | 2 servers |
| **CPU** | 2x 16-core Xeon Silver | 2 | 64 cores |
| **RAM** | 128 GB DDR5 | 2 | 256 GB |
| **Storage** | 4x 3.84 TB SSD (RAID-10) | 2 | 15.36 TB usable |
| **NIC** | 2x 10 GbE | 2 | |

**Software Stack:**
| Component | Purpose | Resource Notes |
|-----------|---------|----------------|
| **Elasticsearch** | Log storage & search | 90-day hot, archive to cold |
| **Kibana** | Log visualization & dashboards | Co-located with ES |
| **Prometheus** | Metrics collection (TPS, latency, error rates) | 30-day retention |
| **Grafana** | Metrics dashboards & alerting | Co-located with Prometheus |
| **Filebeat** | Log shipping from all servers | Lightweight, on each node |
| **Sentry** | Application error tracking (self-hosted) | On monitoring server |

**Key Dashboards:**
- Transaction TPS (real-time)
- DRID lifecycle latency (P50, P95, P99)
- AML flag rate and fraud score distribution
- WhatsApp/SMS delivery success rate
- Database connection pool utilization
- Server CPU/Memory/Disk utilization

**Alerting Thresholds:**
| Metric | Warning | Critical |
|--------|---------|----------|
| API P99 latency | >500ms | >2000ms |
| Transaction error rate | >1% | >5% |
| DB connection pool usage | >70% | >90% |
| Disk usage | >70% | >85% |
| CPU usage (sustained 5 min) | >70% | >90% |
| WhatsApp webhook response time | >10s | >14s (Twilio timeout=15s) |

---

### 4.7 Backup & Storage Tier

| Component | Spec | Purpose |
|-----------|------|---------|
| **NAS/SAN** | 50 TB usable (NetApp / Dell PowerStore) | DB backups, WAL archives, cheque images |
| **Backup Schedule** | Full weekly + incremental daily | PostgreSQL pg_basebackup + WAL |
| **Retention** | 30 days on-disk, 1 year on tape/cold | Compliance |
| **Tape/Cold Storage** | LTO-9 or object store | 7-10 year archival |

**Backup Strategy:**
```
Daily:    Incremental backup via WAL archiving (pgBackRest)
Weekly:   Full base backup (pg_basebackup)
Monthly:  Full backup to tape/cold storage
Yearly:   Archive old partitions to cold storage + verify restore
```

**RTO/RPO Targets:**
| Metric | Target |
|--------|--------|
| RPO (Recovery Point Objective) | < 5 minutes (WAL streaming) |
| RTO (Recovery Time Objective) | < 1 hour (failover to replica) |
| DR RTO | < 4 hours (promote DR replica) |

---

### 4.8 OCR Processing Tier (Optional - If On-Prem OCR Required)

If OpenAI GPT-4o is replaced with on-premises OCR (SBP compliance NFR-010), a GPU-equipped server is needed.

| Spec | Per Server | Qty | Total |
|------|-----------|-----|-------|
| **Server Model** | 2U GPU Server (Dell R760xa) | **1** (+1 standby) | 2 servers |
| **CPU** | 2x Intel Xeon Gold 6438Y+ (32C/64T) | 2 | 128 cores |
| **RAM** | 256 GB DDR5 | 2 | 512 GB |
| **GPU** | 2x NVIDIA A30 (24 GB HBM2) | 2 | 4 GPUs |
| **Storage** | 2x 1.92 TB NVMe SSD (RAID-1) | 2 | 7.68 TB raw |

**Software:** PaddleOCR or Tesseract 5 + custom Urdu model
**Throughput:** ~50 cheque images/second per GPU
**Note:** Only required if cheque OCR is moved on-prem. Can be deferred to Phase 2.

---

## 5. Hardware Sizing - DR Data Center (Active-Passive)

The DR site mirrors the primary DC at reduced capacity (50% scale), ready to be promoted within 4 hours.

| Tier | Primary DC | DR DC | DR Notes |
|------|-----------|-------|----------|
| **App Servers** | 3 servers | 2 servers | Scale up on activation |
| **Messaging Servers** | 2 servers | 1 server | Scale up on activation |
| **DB Primary** | 1 server (256 GB) | 1 server (256 GB) | Streaming replica from primary |
| **DB Read Replicas** | 2 servers | 1 server | Promoted to primary on DR |
| **Redis** | 3 nodes | 2 nodes | Sentinel auto-failover |
| **Nginx** | 2 servers | 1 server | Activate second on DR |
| **Monitoring** | 2 servers | 1 server | Reduced retention |
| **NAS/SAN** | 50 TB | 50 TB | Replicated via SAN replication |
| **OCR (optional)** | 2 servers | 1 server | If on-prem OCR deployed |

**DR Replication:**
- PostgreSQL: Asynchronous streaming replication (async to avoid latency impact)
- Redis: Not replicated to DR (sessions are ephemeral, rebuilt on failover)
- File storage: SAN-level replication or rsync every 15 minutes
- WAL archives: Shipped to DR continuously

---

## 6. Network Requirements

### 6.1 Internal Network

| Segment | Bandwidth | VLAN | Notes |
|---------|-----------|------|-------|
| App ↔ DB | 10/25 Gbps | VLAN 100 | High throughput, low latency |
| App ↔ Redis | 10 Gbps | VLAN 100 | Sub-millisecond latency required |
| App ↔ Nginx | 10 Gbps | VLAN 200 | |
| Monitoring | 10 Gbps | VLAN 300 | Log shipping volume |
| Management/IPMI | 1 Gbps | VLAN 999 | Out-of-band management |

### 6.2 External Connectivity

| Connection | Bandwidth | Purpose |
|------------|-----------|---------|
| Internet (Twilio) | 100 Mbps dedicated | WhatsApp/SMS webhooks |
| T24 Core Banking | Dedicated link / ESB | Transaction posting (low latency) |
| NADRA VERIS | Leased line | CNIC verification |
| DR Site Link | 1 Gbps dedicated | DB replication + WAL shipping |

### 6.3 Firewall Rules (Summary)

| Source | Destination | Port | Protocol |
|--------|-------------|------|----------|
| Internet (Twilio IPs) | Nginx VIP | 443 | HTTPS |
| Branch network | Nginx VIP | 443 | HTTPS |
| Nginx | App servers | 8000 | HTTP |
| Nginx | Messaging servers | 8000 | HTTP |
| App servers | PostgreSQL primary | 5432 | TCP |
| App servers | Redis master | 6379 | TCP |
| App servers | Twilio API | 443 | HTTPS (outbound) |
| DB Primary | DB Replicas | 5432 | TCP (replication) |
| DB Primary | DR DB | 5432 | TCP (WAN replication) |
| All servers | Monitoring | 9090,9200,5044 | Prometheus, ES, Filebeat |

---

## 7. Total Hardware Summary

### 7.1 Primary Data Center

| Tier | Servers | Total CPU Cores | Total RAM | Total Storage | Rack Units |
|------|---------|----------------|-----------|---------------|------------|
| App (API) | 3 | 192 cores | 384 GB | 2.88 TB | 3U |
| Messaging | 2 | 80 cores | 128 GB | 1.92 TB | 2U |
| Database | 3 | 192 cores | 512 GB | 25 TB | 6U |
| Redis Cache | 3 | 24 cores | 96 GB | 2.88 TB | 3U |
| Web/Nginx | 2 | 32 cores | 64 GB | 0.96 TB | 2U |
| Monitoring | 2 | 64 cores | 256 GB | 15.36 TB | 4U |
| OCR (optional) | 2 | 128 cores | 512 GB | 7.68 TB | 4U |
| **Subtotal** | **17** | **712 cores** | **1,952 GB** | **56.68 TB** | **24U** |
| NAS/SAN | -- | -- | -- | 50 TB | 4U |
| Network switches | 2x ToR | -- | -- | -- | 2U |
| Load Balancer (F5) | 2 (HA pair) | -- | -- | -- | 2U |
| **Grand Total Primary** | | | | | **~32U (1 rack)** |

### 7.2 DR Data Center

| Tier | Servers | Total CPU Cores | Total RAM | Total Storage | Rack Units |
|------|---------|----------------|-----------|---------------|------------|
| App (API) | 2 | 128 cores | 256 GB | 1.92 TB | 2U |
| Messaging | 1 | 40 cores | 64 GB | 0.96 TB | 1U |
| Database | 2 | 128 cores | 384 GB | 15.36 TB | 4U |
| Redis Cache | 2 | 16 cores | 64 GB | 1.92 TB | 2U |
| Web/Nginx | 1 | 16 cores | 32 GB | 0.48 TB | 1U |
| Monitoring | 1 | 32 cores | 128 GB | 7.68 TB | 2U |
| OCR (optional) | 1 | 64 cores | 256 GB | 3.84 TB | 2U |
| **Subtotal** | **10** | **424 cores** | **1,184 GB** | **32.16 TB** | **14U** |
| NAS/SAN | -- | -- | -- | 50 TB | 4U |
| Network | 2x ToR + LB | -- | -- | -- | 4U |
| **Grand Total DR** | | | | | **~22U (1 rack)** |

### 7.3 Combined Total

| | Primary | DR | **Total** |
|--|---------|-----|-----------|
| **Physical Servers** | 17 | 10 | **27** |
| **CPU Cores** | 712 | 424 | **1,136** |
| **RAM** | 1,952 GB (~2 TB) | 1,184 GB (~1.2 TB) | **~3.1 TB** |
| **SSD Storage** | 56.68 TB | 32.16 TB | **~89 TB** |
| **NAS/SAN** | 50 TB | 50 TB | **100 TB** |
| **Rack Space** | ~32U | ~22U | **~54U (2 racks)** |

---

## 8. Power & Cooling

| Parameter | Primary DC | DR DC | Total |
|-----------|-----------|-------|-------|
| Estimated power draw | ~12 kW | ~8 kW | ~20 kW |
| UPS requirement | 15 kVA (N+1) | 10 kVA (N+1) | 25 kVA |
| Cooling (BTU/hr) | ~41,000 | ~27,000 | ~68,000 |
| PDU circuits (30A, 220V) | 4 (2 per rack, A+B feed) | 2 | 6 |

---

## 9. Software Licensing

| Software | License Type | Qty | Notes |
|----------|-------------|-----|-------|
| RHEL 9 (or Rocky Linux) | Subscription / Free | 27 servers | Rocky Linux = free alternative |
| PostgreSQL 15 | Open Source (free) | 5 instances | Community or EDB support contract |
| Redis 7 | Open Source (free) | 5 instances | Or Redis Enterprise for support |
| Nginx | Open Source (free) | 3 instances | Or Nginx Plus for advanced LB |
| Docker Engine | Open Source (free) | 17 servers | Or Podman (RHEL native) |
| F5 BIG-IP / HAProxy | Commercial / Free | 2+2 pairs | HAProxy = free alternative |
| ELK Stack | Open Source (free) | 2 clusters | Or Elastic Cloud on-prem license |
| Grafana + Prometheus | Open Source (free) | 2 instances | |
| Sentry (self-hosted) | Open Source (free) | 1 instance | |
| pgBackRest | Open Source (free) | 5 instances | Backup tool |
| PgBouncer | Open Source (free) | 5 instances | Connection pooler |

---

## 10. Phased Deployment Recommendation

### Phase 1: Pilot (5-10 Branches) - Months 1-3

| Tier | Servers | Notes |
|------|---------|-------|
| App | 1 | Single server, 8 workers |
| Messaging | 1 | Combined with app or separate |
| Database | 1 Primary + 1 Replica | Basic HA |
| Redis | 1 (standalone) | No sentinel yet |
| Nginx | 1 | Single reverse proxy |
| Monitoring | 1 | Basic ELK + Grafana |
| **Total** | **5-6 servers** | ~5,000 txn/day capacity |

**Estimated Cost:** 30-40% of full deployment

### Phase 2: Regional (50-100 Branches) - Months 4-6

| Tier | Servers | Notes |
|------|---------|-------|
| App | 2 | Load balanced |
| Messaging | 1 | Dedicated |
| Database | 1 Primary + 1 Replica | + PgBouncer |
| Redis | 3 (Sentinel) | HA enabled |
| Nginx | 2 | Active-Active |
| Monitoring | 1 | Expanded dashboards |
| **Total** | **10-11 servers** | ~50,000 txn/day capacity |

### Phase 3: Nationwide (All Branches) - Months 7-12

Full deployment as specified in Sections 4 and 5.

**Total:** 27 servers (Primary + DR)

---

## 11. Capacity Scaling Triggers

| Metric | Current Threshold | Action |
|--------|------------------|--------|
| Average CPU utilization > 65% (sustained 1 week) | 65% | Add 1 app server |
| DB connection pool > 80% utilized | 80% | Add read replica or increase pool |
| Transaction P99 latency > 500ms | 500ms | Profile queries, add app server or read replica |
| DB storage > 70% used | 70% | Expand storage / archive old partitions |
| Redis memory > 70% of maxmemory | 70% | Increase maxmemory or add shard |
| WhatsApp webhook response > 10s | 10s | Add messaging server |
| Daily transactions exceed 150K | 150K/day | Prepare for Phase 3+ expansion |

---

## 12. Appendix A: Bill of Materials (BOM) Summary

> Note: Prices are approximate and subject to vendor quotation.

| # | Item | Qty | Est. Unit Price (USD) | Est. Total (USD) |
|---|------|-----|-----------------------|-------------------|
| 1 | Dell R660 / HPE DL360 (App + Msg + Web + Redis) | 16 | $8,000 - $12,000 | $128,000 - $192,000 |
| 2 | Dell R760 / HPE DL380 (Database + Monitoring) | 7 | $15,000 - $25,000 | $105,000 - $175,000 |
| 3 | Dell R760xa (GPU/OCR - optional) | 3 | $25,000 - $40,000 | $75,000 - $120,000 |
| 4 | NAS/SAN 50TB (x2) | 2 | $30,000 - $50,000 | $60,000 - $100,000 |
| 5 | Network Switches (ToR, 25GbE) | 4 | $5,000 - $10,000 | $20,000 - $40,000 |
| 6 | F5 BIG-IP (HA pair x2) | 2 pairs | $15,000 - $30,000 | $30,000 - $60,000 |
| 7 | UPS (15kVA + 10kVA) | 2 | $5,000 - $8,000 | $10,000 - $16,000 |
| 8 | Rack (42U) + PDU + Cabling | 2 | $3,000 - $5,000 | $6,000 - $10,000 |
| | **Subtotal (Hardware)** | | | **$434,000 - $713,000** |
| 9 | RHEL Subscriptions (if not Rocky) | 27 | $800/yr | $21,600/yr |
| 10 | EDB PostgreSQL Support (optional) | 1 contract | $15,000/yr | $15,000/yr |
| 11 | Twilio (WhatsApp BSP + SMS) | usage-based | ~$5,000/mo | ~$60,000/yr |
| | **Annual OpEx** | | | **~$96,600/yr** |

---

## 13. Appendix B: Key Assumptions & Risks

### Assumptions
1. Meezan Bank's existing DC has adequate power, cooling, and rack space
2. Network connectivity between Primary and DR DC exists (1 Gbps+)
3. T24 core banking system can handle the projected transaction volume
4. Twilio WhatsApp Business API approval will be obtained for production
5. SBP will accept the described HA/DR architecture for compliance

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| T24 integration latency | Transaction completion >2s | Circuit breaker + async posting |
| Twilio outage | WhatsApp/SMS channel down | Multi-provider fallback (360dialog) |
| Single-DC failure | Full system outage | DR activation (<4 hr RTO) |
| DB growth exceeds projections | Storage exhaustion | Partition archival + monitoring alerts |
| On-prem OCR accuracy | Cheque rejection rate increases | Hybrid: on-prem primary, cloud fallback |
| Peak Ramadan/Eid traffic | 3-5x normal volume | Pre-scale app tier 1 week before |

---

## 14. Approval & Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Project Manager | | | |
| Solution Architect | | | |
| Infrastructure Lead | | | |
| DBA Lead | | | |
| Security Officer | | | |
| IT Operations Head | | | |

---

*End of Document*
