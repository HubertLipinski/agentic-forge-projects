# Dynamic Authorization Server

A standalone, policy-driven authorization API server that decouples authorization logic from your core application services. It provides a central point for managing complex access control rules (RBAC, ABAC) via a simple JSON-based policy language and a high-performance REST API. Ideal for microservices architectures where centralized, consistent authorization is critical.

## Features

-   **Centralized Policy Management**: Full CRUD API for managing authorization policies.
-   **High Performance**: Sub-10ms latency for authorization checks via an in-memory cache.
-   **Expressive Policy Language**: Supports both Role-Based (RBAC) and Attribute-Based (ABAC) control using [JSON Logic](https://jsonlogic.com/).
-   **Hot-Reloading**: Update policies with zero downtime. Changes are reflected instantly.
-   **Audit Logging**: Detailed, structured logs for every authorization decision (allow/deny).
-   **Standalone & Lightweight**: Runs as a separate Node.js service with minimal dependencies.

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/dynamic-authorization-server.git
    cd dynamic-authorization-server
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

## Usage

### Running the Server

Start the server in development mode with live-reloading and pretty-printed logs:

```bash
npm run dev
```

For production, use the standard start script:

```bash
npm start
```

The server will start on `http://127.0.0.1:3000` by default.

### API Overview

The server exposes two main sets of endpoints:

1.  `/policies`: A RESTful API for creating, reading, updating, and deleting authorization policies.
2.  `/authorize`: A high-performance endpoint for making authorization decisions.

### Policy Language

Policies are JSON documents that use [JSON Logic](https://jsonlogic.com/) to define conditions. The engine evaluates these conditions against a `context` object you provide.

A policy has three main parts:
-   `id`: A unique string identifier.
-   `description`: A human-readable explanation.
-   `condition`: A JSON Logic rule that must evaluate to `true` for the policy to grant access.

**Example Policy:**
This policy allows a user to read a document if they are an `admin` or if they are the `owner` of the document.

```json
{
  "id": "doc-read-owner-or-admin",
  "description": "Allow reading a document if the user is an admin or the document owner.",
  "condition": {
    "or": [
      { "in": ["admin", { "var": "user.roles" }] },
      { "==": [{ "var": "user.id" }, { "var": "resource.ownerId" }] }
    ]
  }
}
```

## Examples

### 1. Create a Policy

First, let's create the policy from the example above.

**Request:** `POST /policies`

```bash
curl -X POST http://127.0.0.1:3000/policies \
-H "Content-Type: application/json" \
-d '{
  "id": "doc-read-owner-or-admin",
  "description": "Allow reading a document if the user is an admin or the document owner.",
  "condition": {
    "or": [
      { "in": ["admin", { "var": "user.roles" }] },
      { "==": [{ "var": "user.id" }, { "var": "resource.ownerId" }] }
    ]
  }
}'
```

**Response:** `201 Created`

```json
{
  "id": "doc-read-owner-or-admin",
  "description": "Allow reading a document if the user is an admin or the document owner.",
  "condition": {
    "or": [
      { "in": ["admin", { "var": "user.roles" }] },
      { "==": [{ "var": "user.id" }, { "var": "resource.ownerId" }] }
    ]
  },
  "metadata": null
}
```

### 2. Check Authorization (Allow)

Now, let's check if a user who is the document's owner can read it.

**Request:** `POST /authorize`

```bash
curl -X POST http://127.0.0.1:3000/authorize \
-H "Content-Type: application/json" \
-d '{
  "context": {
    "user": {
      "id": "user-123",
      "roles": ["editor"]
    },
    "resource": {
      "type": "document",
      "id": "doc-abc",
      "ownerId": "user-123"
    }
  }
}'
```

**Response:** `200 OK`

```json
{
  "decision": "allow",
  "matchedPolicyId": "doc-read-owner-or-admin",
  "reasons": [
    "Allowed by policy \"doc-read-owner-or-admin\": Allow reading a document if the user is an admin or the document owner."
  ]
}
```

### 3. Check Authorization (Deny)

Finally, let's check a user who is neither an admin nor the owner.

**Request:** `POST /authorize`

```bash
curl -X POST http://127.0.0.1:3000/authorize \
-H "Content-Type: application/json" \
-d '{
  "context": {
    "user": {
      "id": "user-456",
      "roles": ["viewer"]
    },
    "resource": {
      "type": "document",
      "id": "doc-abc",
      "ownerId": "user-123"
    }
  }
}'
```

**Response:** `200 OK`

```json
{
  "decision": "deny",
  "matchedPolicyId": null,
  "reasons": [
    "Default deny: No policy explicitly allowed the request."
  ]
}
```

## License

[MIT](LICENSE)