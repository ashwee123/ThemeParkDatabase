USE newthemepark;

-- =============================================================
-- TABLES
-- =============================================================
CREATE TABLE IF NOT EXISTS RetailPlace (
    RetailID   INT          NOT NULL AUTO_INCREMENT,
    RetailName VARCHAR(100) NOT NULL,
    AreaID     INT          NOT NULL,
    PRIMARY KEY (RetailID),
    UNIQUE (RetailName),
    FOREIGN KEY (AreaID) REFERENCES Area(AreaID)
);

CREATE TABLE IF NOT EXISTS RetailManager (
    ManagerID INT NOT NULL,
    AreaID    INT NOT NULL,
    PRIMARY KEY (ManagerID),
    UNIQUE (AreaID),
    FOREIGN KEY (ManagerID) REFERENCES Manager(ManagerID),
    FOREIGN KEY (AreaID)    REFERENCES Area(AreaID)
);

CREATE TABLE IF NOT EXISTS RetailItem (
    ItemID             INT            NOT NULL AUTO_INCREMENT,
    ItemName           VARCHAR(100)   NOT NULL,
    BuyPrice           DECIMAL(10,2)  NOT NULL,
    SellPrice          DECIMAL(10,2)  NOT NULL,
    DiscountPrice      DECIMAL(10,2)  NULL,
    Quantity           INT            NOT NULL DEFAULT 0,
    LowStockThreshold  INT            NOT NULL DEFAULT 10,
    IsActive           BOOLEAN        NOT NULL DEFAULT TRUE,
    RetailID           INT            NOT NULL,
    PRIMARY KEY (ItemID),
    FOREIGN KEY (RetailID) REFERENCES RetailPlace(RetailID),
    CHECK (BuyPrice           >  0),
    CHECK (SellPrice          >= BuyPrice),
    CHECK (DiscountPrice      IS NULL OR (DiscountPrice > 0 AND DiscountPrice < SellPrice)),
    CHECK (Quantity            >= 0),
    CHECK (LowStockThreshold  >  0)
);

CREATE TABLE IF NOT EXISTS RestockLog (
    RestockID INT           NOT NULL AUTO_INCREMENT,
    ItemID    INT           NOT NULL,
    Quantity  INT           NOT NULL,
    Cost      DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (RestockID),
    FOREIGN KEY (ItemID) REFERENCES RetailItem(ItemID),
    CHECK (Quantity > 0),
    CHECK (Cost     > 0)
);

CREATE TABLE IF NOT EXISTS TransactionLog (
    TransactionID INT           NOT NULL AUTO_INCREMENT,
    ItemID        INT           NOT NULL,
    Date          DATE          NOT NULL,
    Time          TIME          NOT NULL,
    Type          ENUM('Normal','Discount','Damaged','Stolen') NOT NULL,
    Price         DECIMAL(10,2) NOT NULL,
    Quantity      INT           NOT NULL,
    TotalCost     DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (TransactionID),
    FOREIGN KEY (ItemID) REFERENCES RetailItem(ItemID),
    CHECK (Price     >= 0),
    CHECK (Quantity  >  0),
    CHECK (TotalCost >= 0)
);

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

    -- Set Price based on Type
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
    DECLARE v_NewQuantity     INT;
    DECLARE v_Threshold       INT;
    DECLARE v_AreaID          INT;
    DECLARE v_ManagerID       INT;

    -- Subtract quantity from item
    UPDATE RetailItem
    SET Quantity = Quantity - NEW.Quantity
    WHERE ItemID = NEW.ItemID;

    -- Get updated quantity and threshold
    SELECT Quantity, LowStockThreshold, RetailPlace.AreaID
    INTO v_NewQuantity, v_Threshold, v_AreaID
    FROM RetailItem
    JOIN RetailPlace ON RetailItem.RetailID = RetailPlace.RetailID
    WHERE RetailItem.ItemID = NEW.ItemID;

    -- Check low stock and get manager
    IF v_NewQuantity <= v_Threshold THEN
        SELECT ManagerID INTO v_ManagerID
        FROM RetailManager
        WHERE AreaID = v_AreaID;

        -- Notification placeholder:
        -- Replace with your notification logic e.g. insert into a NotificationLog table
        INSERT INTO NotificationLog (ManagerID, ItemID, Message, CreatedAt)
        VALUES (
            v_ManagerID,
            NEW.ItemID,
            CONCAT('Low stock alert: Item ', NEW.ItemID, ' has ', v_NewQuantity, ' units remaining.'),
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

-- =============================================================
-- NOTIFICATION TABLE (used by low stock trigger)
-- =============================================================

CREATE TABLE NotificationLog (
    NotificationID INT          NOT NULL AUTO_INCREMENT,
    ManagerID      INT          NOT NULL,
    ItemID         INT          NOT NULL,
    Message        VARCHAR(255) NOT NULL,
    CreatedAt      DATETIME     NOT NULL,
    PRIMARY KEY (NotificationID),
    FOREIGN KEY (ManagerID) REFERENCES RetailManager(ManagerID),
    FOREIGN KEY (ItemID)    REFERENCES RetailItem(ItemID)
);

-- =============================================================
--   REMAKE OF TRANSACTION LOG
-- =============================================================

DROP TABLE IF EXISTS TransactionLog;

CREATE TABLE TransactionLog (
    TransactionID INT AUTO_INCREMENT PRIMARY KEY,
    ItemID INT NOT NULL,
    VisitorID INT NOT NULL,
    Date DATE NOT NULL,
    Time TIME NOT NULL,
    Type ENUM('Normal','Discount','Damaged','Stolen') NOT NULL,
    Price DECIMAL(10,2) NOT NULL,
    Quantity INT NOT NULL,
    TotalCost DECIMAL(10,2) NOT NULL,

    FOREIGN KEY (ItemID) REFERENCES RetailItem(ItemID),
    FOREIGN KEY (VisitorID) REFERENCES visitor(VisitorID),

    CHECK (Price >= 0),
    CHECK (Quantity > 0),
    CHECK (TotalCost >= 0)
);
