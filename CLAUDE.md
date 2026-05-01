# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sistema Nacional de Cmputo Electoral** — a distributed electoral computing system for processing and publishing election results. The project is a university distributed systems assignment (Prctica 4).

The system has two parallel pipelines for election data:
- **RRV (Recuento Rpido de Votos):** Preliminary real-time results from OCR-processed ballot images. Uses eventual consistency, async processing, and event sourcing.
- **Oficial (Cmputo Oficial):** Official results from validated CSV transcriptions. Uses strong consistency, strict validation, and full audit trails.

Both pipelines share a distributed database layer and feed into a unified dashboard.

## Architecture

```
app_movil --> rrv --> bdd <-- oficial
                 \         /
                  dashboard
```

- **CQRS** pattern across both RRV and Oficial subsystems (separate read/write paths)
- **Event Sourcing** for the RRV pipeline
- **Distributed DB cluster** (`bdd/`) with synchronous replication for Oficial and asynchronous replication for RRV
- Real-time updates flow to the dashboard via APIs

## Module Layout

| Directory    | Purpose |
|-------------|---------|
| `rrv/`      | Rapid vote count microservices (OCR, validation, event store, results publication) |
| `oficial/`  | Official compute system (CSV ingestion, validation rules, audit, official results) |
| `bdd/`      | Distributed database infrastructure shared by both pipelines |
| `app_movil/` | Mobile app for field operators to capture and send ballot images to RRV |
| `dashboard/` | Real-time visualization frontend consuming both RRV and Oficial APIs |

## Git Workflow

- `main` branch is the base for PRs
- Feature branches per team member (e.g., `Pablo`, `dev`)
- Language: Spanish for documentation and commit messages

## Approach

- Read existing files before writing. Don't re-read unless changed.
- Be thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes.