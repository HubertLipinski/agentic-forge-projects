# JSDoc to REST API Generator

A powerful CLI tool that automates the creation of a production-ready REST API server directly from JSDoc-annotated JavaScript service files. It inspects your functions, parameters, and return types to generate a complete Express.js application with routing, validation, and serialization, drastically reducing boilerplate.

## Features

-   **JSDoc Parsing**: Extracts API information from standard JSDoc tags like `@param`, `@returns`, `@throws`, and the custom `@route`.
-   **Express.js Generation**: Creates a complete, runnable Express.js server from your service logic.
-   **Automatic Validation**: Generates AJV JSON Schemas from JSDoc types for robust request validation (path, query, and body).
-   **Static Analysis**: Uses Acorn to statically analyze your code, reliably linking JSDoc comments to their corresponding functions.
-   **CLI Interface**: Simple and intuitive CLI built with Yargs for easy integration into your workflow.
-   **Code Quality**: All generated code is automatically formatted with Prettier and linted with ESLint for production-readiness.
-   **Customizable**: Uses EJS templates, allowing you to customize the generated output to fit your project's specific needs.

## Installation

You can use the tool by cloning the repository and running it directly with `npm`, or install it globally to use the `generate-api` command anywhere.

**Clone and Run:**

```bash
git clone https://github.com/your-username/jsdoc-to-rest.git
cd jsdoc-to-rest
npm install
```

**Global Installation (Recommended for ease of use):**

```bash
npm install -g .
# Or, if you publish to npm:
# npm install -g jsdoc-to-rest
```

## Usage

The CLI tool `generate-api` takes a source directory and an output directory as arguments. It will scan the source directory for `.js` files, analyze the JSDoc comments, and generate a new Express.js project in the output directory.

### CLI Command

```bash
generate-api <source> <output> [options]
```

### Arguments

-   `<source>`: The path to the directory containing your JSDoc-annotated service files (e.g., `./examples/services`).
-   `<output>`: The path where the new Express.js project will be created (e.g., `./dist-api`).

### Options

-   `--help`: Show help
-   `--version`: Show version number

### Example Command

```bash
# Generate an API from the 'examples/services' directory
# and output the project to a new 'my-generated-api' folder.
generate-api ./examples/services ./my-generated-api
```

After running the command, you can start your new API server:

```bash
cd ./my-generated-api
npm install
npm start
```

Your server will be running on `http://localhost:3000`.

## JSDoc Conventions

To define an API endpoint, add a JSDoc block above a function. The key tags are `@route`, `@param`, `@returns`, and `@throws`.

### `@route {METHOD} /path`

This tag is **required** to mark a function as an API endpoint.

-   `{METHOD}`: The HTTP method (e.g., `GET`, `POST`, `PUT`, `DELETE`).
-   `/path`: The URL path for the endpoint. Use Express.js syntax for path parameters (e.g., `/users/:id`).

### `@param`

Defines a request parameter. The generator automatically categorizes parameters into `path`, `query`, or `body`.

-   **Path Parameters**: If a param name matches a segment in the `@route` path (e.g., `:id`), it's treated as a path parameter.
-   **Request Body**: A parameter named `body` or `requestBody` is used as the schema for the request body. Only one is allowed per endpoint.
-   **Query Parameters**: All other parameters are treated as query string parameters.

The type definition can be a simple type (`string`, `number`) or a JSON Schema object literal for detailed validation.

```js
// Simple query param
/** @param {string} name - The user's name. */

// Detailed body schema
/** @param {{type: 'object', properties: {email: {type: 'string', format: 'email'}}, required: ['email']}} body - The request body. */
```

### `@returns` and `@throws`

Define possible responses. The status code can be included in the first type block. If omitted, `@returns` defaults to `200` and `@throws` defaults to `500`.

```js
// Success response with a 200 status code
/** @returns {{id: string, name: string}} The created user object. */

// Success response with a custom 201 status code
/** @returns {201} {{id: string}} The ID of the newly created user. */

// Error response with a 404 status code
/** @throws {404} User not found. */
```

## Examples

### 1. Basic GET Endpoint

Here is a simple service function to fetch a user by ID.

**`examples/services/user-service.js`**
```javascript
/**
 * Retrieves a user by their unique ID.
 * @route {GET} /users/:id
 * @param {string} id - The unique identifier of the user.
 * @returns {200} {{id: string, name: string, email: string}} The user object.
 * @throws {404} If the user with the specified ID is not found.
 */
export function getUserById(id) {
  // In a real app, you would fetch this from a database.
  if (id === '1') {
    return { id: '1', name: 'Jane Doe', email: 'jane.doe@example.com' };
  }
  // To trigger the @throws response, you would throw an error.
  // The generated error handler would catch it and send a 404.
  throw new Error('User not found');
}
```

**Generated Route in `router.js` (simplified):**
```javascript
// ... imports and AJV setup ...
router.get(
  '/users/:id',
  // Validation middleware for path params
  (req, res, next) => { /* ... */ },
  async (req, res, next) => {
    try {
      const result = await userService.getUserById(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      // The generated error handler maps this to a 404 response
      next(error);
    }
  }
);
```

### 2. POST Endpoint with Body Validation

This example shows how to define an endpoint that accepts a request body with validation rules.

**`examples/services/user-service.js`**
```javascript
/**
 * Creates a new user.
 * @route {POST} /users
 * @param {{
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string', minLength: 2 },
 *     email: { type: 'string', format: 'email' }
 *   },
 *   required: ['name', 'email']
 * }} body - The user data to create.
 * @returns {201} {{id: string, name: string, email: string}} The newly created user.
 * @throws {400} If the request body is invalid.
 */
export function createUser(body) {
  const newUser = {
    id: String(Date.now()), // Generate a simple unique ID
    ...body,
  };
  // In a real app, save the user to the database.
  return newUser;
}
```

**Generated Behavior:**

The generator will create an AJV schema from the `@param` tag and wire it into the Express route as a validation middleware. If a `POST` request is made to `/users` with a missing `name` or an invalid `email`, the API will automatically respond with a `400 Bad Request` error before your `createUser` function is even called.

## License

[MIT](LICENSE)