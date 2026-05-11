# Logging Middleware

A reusable logging package that sends structured logs to a remote logging server.

## Setup

```bash
npm install
```

## Usage

```javascript
const { Log } = require("./logger");

await Log(stack, level, package, message);
```

## Parameters

| Parameter | Type   | Allowed Values |
|-----------|--------|----------------|
| stack     | string | `backend`, `frontend` |
| level     | string | `debug`, `info`, `warn`, `error`, `fatal` |
| package   | string | `cache`, `controller`, `cron_job`, `db`, `domain`, `handler`, `repository`, `route`, `service`, `auth`, `config`, `middleware`, `utils` |
| message   | string | Any descriptive string |

## Example

```javascript
await Log("backend", "error", "db", "Database connection failed");
```