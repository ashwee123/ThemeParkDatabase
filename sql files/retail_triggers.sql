-- =============================================================
-- TRIGGERS
-- =============================================================

DELIMITER $$

-- -------------------------------------------------------------
-- RestockLog — ON INSERT
-- 1. Auto-calculate Cost = BuyPrice × Quantity
-- 2. Add Quantity to RetailItem.Quantity
-- -------------------------------------------------------------
CREATE TRIGGER trg_RestockLog_BeforeInsert
BEFORE INSERT ON RestockLog
FOR EACH ROW
BEGIN
    DECLARE v_BuyPrice DECIMAL(10,2);

    SELECT BuyPrice INTO v_BuyPrice
    FROM RetailItem
    WHERE ItemID = NEW.ItemID;

    SET NEW.Cost = v_BuyPrice * NEW.Quantity;
END$$

CREATE TRIGGER trg_RestockLog_AfterInsert
AFTER INSERT ON RestockLog
FOR EACH ROW
BEGIN
    UPDATE RetailItem
    SET Quantity = Quantity + NEW.Quantity
    WHERE ItemID = NEW.ItemID;
END$$

-- -------------------------------------------------------------
-- TransactionLog — ON INSERT
-- 1. Validate and set Price based on Type
-- 2. Auto-calculate TotalCost = Price × Quantity
-- 3. Subtract Quantity from RetailItem.Quantity
-- 4. Notify manager if stock falls <= LowStockThreshold
-- -------------------------------------------------------------
CREATE TRIGGER trg_TransactionLog_BeforeInsert
BEFORE INSERT ON TransactionLog
FOR EACH ROW
BEGIN
    DECLARE v_SellPrice     DECIMAL(10,2);
    DECLARE v_DiscountPrice DECIMAL(10,2);

    SELECT SellPrice, DiscountPrice
    INTO v_SellPrice, v_DiscountPrice
    FROM RetailItem
    WHERE ItemID = NEW.ItemID;

    IF NEW.Type = 'Normal' THEN
        SET NEW.Price = v_SellPrice;
    ELSEIF NEW.Type = 'Discount' THEN
        SET NEW.Price = v_DiscountPrice;
    ELSEIF NEW.Type IN ('Damaged', 'Stolen') THEN
        SET NEW.Price = 0;
    END IF;

    SET NEW.TotalCost = NEW.Price * NEW.Quantity;
END$$

CREATE TRIGGER trg_TransactionLog_AfterInsert
AFTER INSERT ON TransactionLog
FOR EACH ROW
BEGIN
    DECLARE v_NewQuantity  INT;
    DECLARE v_Threshold    INT;
    DECLARE v_AreaID       INT;
    DECLARE v_ManagerID    INT;
    DECLARE v_ItemName     VARCHAR(100);

    UPDATE RetailItem
    SET Quantity = Quantity - NEW.Quantity
    WHERE ItemID = NEW.ItemID;

    SELECT ri.Quantity, ri.LowStockThreshold, ri.ItemName, rp.AreaID
    INTO v_NewQuantity, v_Threshold, v_ItemName, v_AreaID
    FROM RetailItem ri
    JOIN RetailPlace rp ON ri.RetailID = rp.RetailID
    WHERE ri.ItemID = NEW.ItemID;

    IF v_NewQuantity <= v_Threshold THEN
        SELECT ManagerID INTO v_ManagerID
        FROM RetailManager
        WHERE AreaID = v_AreaID;

        INSERT INTO NotificationLog (ManagerID, ItemID, Message, CreatedAt)
        VALUES (
            v_ManagerID,
            NEW.ItemID,
            CONCAT(v_ItemName, ' has ', v_NewQuantity, ' units left.'),
            NOW()
        );
    END IF;
END$$

-- -------------------------------------------------------------
-- RetailItem — ON UPDATE of BuyPrice, SellPrice, DiscountPrice
-- 1. Verify SellPrice >= BuyPrice
-- 2. Verify DiscountPrice < SellPrice (if not NULL)
-- -------------------------------------------------------------
CREATE TRIGGER trg_RetailItem_BeforeUpdate
BEFORE UPDATE ON RetailItem
FOR EACH ROW
BEGIN
    IF NEW.SellPrice < NEW.BuyPrice THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'SellPrice must be >= BuyPrice';
    END IF;

    IF NEW.DiscountPrice IS NOT NULL THEN
        IF NEW.DiscountPrice >= NEW.SellPrice OR NEW.DiscountPrice <= 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'DiscountPrice must be > 0 and < SellPrice';
        END IF;
    END IF;
END$$

DELIMITER ;