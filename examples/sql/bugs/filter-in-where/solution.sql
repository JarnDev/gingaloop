-- BUG (plausible alternative): the status filter in WHERE runs after the LEFT JOIN and removes the
-- unmatched (NULL) rows, quietly turning it back into an inner join.
SELECT c.name,
       COUNT(o.id)                     AS paid_orders,
       COALESCE(SUM(o.amount_cents), 0) AS paid_cents
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id
WHERE o.status = 'paid' OR o.id IS NULL
GROUP BY c.id, c.name
ORDER BY paid_cents DESC, c.name ASC;
