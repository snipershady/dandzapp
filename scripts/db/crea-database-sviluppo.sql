-- Database e utente per lo SVILUPPO locale (non usare queste credenziali in produzione).
-- Esecuzione: sudo mysql < scripts/db/crea-database-sviluppo.sql
CREATE DATABASE IF NOT EXISTS tavolo CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS tavolo_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'tavolo'@'localhost' IDENTIFIED BY 'tavolo_dev';
CREATE USER IF NOT EXISTS 'tavolo'@'127.0.0.1' IDENTIFIED BY 'tavolo_dev';
GRANT ALL PRIVILEGES ON tavolo.* TO 'tavolo'@'localhost', 'tavolo'@'127.0.0.1';
GRANT ALL PRIVILEGES ON tavolo_test.* TO 'tavolo'@'localhost', 'tavolo'@'127.0.0.1';
