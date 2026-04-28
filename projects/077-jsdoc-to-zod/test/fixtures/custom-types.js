/**
 * @fileoverview A sample file using @typedef to test custom type resolution.
 * This fixture provides examples of simple type aliases, nested custom types,
 * and unions involving custom types, which the generator must correctly resolve.
 * @author Your Name <you@example.com>
 * @license MIT
 * @project JSDoc to Zod Schema Generator
 */

/**
 * A simple type alias for a universally unique identifier.
 * @typedef {string} UUID
 */

/**
 * A type alias for a union of possible status values.
 * @typedef {'pending' | 'processing' | 'completed' | 'failed'} OrderStatus
 */

/**
 * Represents a single item within an order.
 * @typedef {object} OrderItem
 * @property {UUID} productId - The ID of the product.
 * @property {number} quantity - The number of units for this item.
 * @property {number} price - The price per unit at the time of purchase.
 */

/**
 * Represents a customer's order. This type demonstrates nesting of other
 * custom types (`UUID`, `OrderItem`, `OrderStatus`).
 * @typedef {object} Order
 * @property {UUID} orderId - The unique identifier for the order.
 * @property {string} customerName - The name of the customer placing the order.
 * @property {OrderItem[]} items - An array of items included in the order.
 * @property {OrderStatus} status - The current status of the order.
 * @property {Date} createdAt - The timestamp when the order was created.
 */

/**
 * A contact can be either an email address or a phone number.
 * This tests a simple union of primitive types.
 * @typedef {string | number} ContactMethod
 */

/**
 * Processes a batch of orders.
 * This function uses the custom `Order` type in its parameters and return value,
 * testing the generator's ability to reference pre-defined schemas.
 *
 * @param {Order[]} orders - An array of orders to process.
 * @param {object} [options] - Optional processing settings.
 * @param {boolean} [options.sendConfirmation=true] - Whether to send a confirmation email.
 * @returns {Promise<Order[]>} A promise that resolves with the processed orders,
 *   which may have updated statuses.
 */
export async function processOrders(orders, options = { sendConfirmation: true }) {
	if (!Array.isArray(orders)) {
		return Promise.reject(new Error('Input must be an array of orders.'));
	}

	const processed = orders.map(order => {
		// Simulate some processing logic
		if (order.status === 'pending') {
			return {
				...order,
				status: 'processing',
			};
		}
		return order;
	});

	if (options.sendConfirmation) {
		console.log(`Sending confirmations for ${processed.length} orders.`);
	}

	return Promise.resolve(processed);
}