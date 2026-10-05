-- BUG (plausible alternative): a plain JOIN only keeps customers that have a paid order.
SELECT c.name,
       COUNT(o.id)                     AS paid_orders,
       COALESCE(SUM(o.amount_cents), 0) AS paid_cents
FROM customers AS c
JOIN orders AS o
  ON o.customer_id = c.id
 AND o.status = 'paid'
GROUP BY c.id, c.name
ORDER BY paid_cents DESC, c.name ASC;
