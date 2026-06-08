-- Idempotent seed for certificate_pricing.
-- Requires UNIQUE on (level_name, certificate_type) for ON DUPLICATE KEY UPDATE (add once if missing).

INSERT INTO certificate_pricing
(level_name, certificate_type, base_price,
 normal_courier_price, special_courier_price,
 is_active)
VALUES
('General', 'Hardcopy+PDF', 0.00, 0.00, 0.00, 1),
('General', 'Hardcopy', 0.00, 0.00, 0.00, 1),
('General', 'Softcopy', 0.00, 0.00, 0.00, 1),
('Level 1', 'Hardcopy+PDF', 0.00, 0.00, 0.00, 1),
('Level 1', 'Hardcopy', 0.00, 0.00, 0.00, 1),
('Level 1', 'Softcopy', 0.00, 0.00, 0.00, 1),
('Level 2', 'Hardcopy+PDF', 0.00, 0.00, 0.00, 1),
('Level 2', 'Hardcopy', 0.00, 0.00, 0.00, 1),
('Level 2', 'Softcopy', 0.00, 0.00, 0.00, 1),
('Level 3', 'Hardcopy+PDF', 0.00, 0.00, 0.00, 1),
('Level 3', 'Hardcopy', 0.00, 0.00, 0.00, 1),
('Level 3', 'Softcopy', 0.00, 0.00, 0.00, 1),
('Level 4', 'Hardcopy+PDF', 0.00, 0.00, 0.00, 1),
('Level 4', 'Hardcopy', 0.00, 0.00, 0.00, 1),
('Level 4', 'Softcopy', 0.00, 0.00, 0.00, 1),
('Level 5', 'Hardcopy+PDF', 0.00, 0.00, 0.00, 1),
('Level 5', 'Hardcopy', 0.00, 0.00, 0.00, 1),
('Level 5', 'Softcopy', 0.00, 0.00, 0.00, 1),
('Level 6', 'Hardcopy+PDF', 0.00, 0.00, 0.00, 1),
('Level 6', 'Hardcopy', 0.00, 0.00, 0.00, 1),
('Level 6', 'Softcopy', 0.00, 0.00, 0.00, 1),
('Level 7', 'Hardcopy+PDF', 0.00, 0.00, 0.00, 1),
('Level 7', 'Hardcopy', 0.00, 0.00, 0.00, 1),
('Level 7', 'Softcopy', 0.00, 0.00, 0.00, 1)
ON DUPLICATE KEY UPDATE id = id;
