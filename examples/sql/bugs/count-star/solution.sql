SELECT c.name,
       COUNT(*)                        AS paid_orders, -- BUG: counts the NULL row of a customer without orders as 1
       COALESCE(SUM(o.amount_cents), 0) AS paid_cents
FROM customers AS c
LEFT JOIN orders AS o
       ON o.customer_id = c.id
      AND o.status = 'paid'
GROUP BY c.id, c.name
ORDER BY paid_cents DESC, c.name ASC;
