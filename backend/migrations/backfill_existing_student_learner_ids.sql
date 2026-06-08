SET @next_num := (
  SELECT COALESCE(MAX(CAST(SUBSTRING(learner_id, 4) AS UNSIGNED)), 0)
  FROM users
  WHERE learner_id REGEXP '^ILC[0-9]+$'
);

UPDATE users u
JOIN (
  SELECT ordered.id,
         ordered.seq_num,
         CASE
           WHEN CAST(ordered.seq_num AS UNSIGNED) < 10 THEN CONCAT('00', CAST(ordered.seq_num AS UNSIGNED))
           WHEN CAST(ordered.seq_num AS UNSIGNED) < 100 THEN CONCAT('0', CAST(ordered.seq_num AS UNSIGNED))
           ELSE CAST(CAST(ordered.seq_num AS UNSIGNED) AS CHAR)
         END AS seq_padded
  FROM (
    SELECT u2.id, (@next_num := @next_num + 1) AS seq_num
    FROM users u2
    JOIN roles r2 ON r2.id = u2.role_id
    WHERE r2.name IN ('Student', 'ManagerStudent', 'InstituteStudent')
      AND (u2.learner_id IS NULL OR TRIM(u2.learner_id) = '')
    ORDER BY u2.id ASC
  ) ordered
) seq ON seq.id = u.id
SET u.learner_id = CONCAT('ILC', seq.seq_padded);
