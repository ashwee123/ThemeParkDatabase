-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: themepark6.mysql.database.azure.com    Database: newthemepark
-- ------------------------------------------------------
-- Server version	8.0.42-azure

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `accidenthistory`
--

DROP TABLE IF EXISTS `accidenthistory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accidenthistory` (
  `AccidentID` int NOT NULL,
  `AttractionID` int DEFAULT NULL,
  `DateOfAccident` date DEFAULT NULL,
  `Severity` enum('Low','Medium','High') DEFAULT NULL,
  PRIMARY KEY (`AccidentID`),
  KEY `AttractionID` (`AttractionID`),
  CONSTRAINT `accidenthistory_ibfk_1` FOREIGN KEY (`AttractionID`) REFERENCES `attraction` (`AttractionID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accidenthistory`
--

LOCK TABLES `accidenthistory` WRITE;
/*!40000 ALTER TABLE `accidenthistory` DISABLE KEYS */;
/*!40000 ALTER TABLE `accidenthistory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `activemaintenancealerts`
--

DROP TABLE IF EXISTS `activemaintenancealerts`;
/*!50001 DROP VIEW IF EXISTS `activemaintenancealerts`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `activemaintenancealerts` AS SELECT 
 1 AS `AlertID`,
 1 AS `AttractionName`,
 1 AS `SeverityLevel`,
 1 AS `AlertMessage`,
 1 AS `CreatedAt`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `area`
--

DROP TABLE IF EXISTS `area`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `area` (
  `AreaID` int NOT NULL,
  `AreaName` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`AreaID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `area`
--

LOCK TABLES `area` WRITE;
/*!40000 ALTER TABLE `area` DISABLE KEYS */;
INSERT INTO `area` VALUES (1,'Zone A'),(101,'rides zone'),(102,'food court'),(103,'kids area');
/*!40000 ALTER TABLE `area` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attraction`
--

DROP TABLE IF EXISTS `attraction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attraction` (
  `AttractionID` int NOT NULL,
  `AttractionName` varchar(100) NOT NULL,
  `AttractionType` enum('Ride','Show','Game') NOT NULL,
  `AreaID` int DEFAULT NULL,
  `Status` enum('Open','Closed','Restricted','NeedsMaintenance','UnderMaintenance','ClosedDueToWeather') DEFAULT 'Open',
  `QueueCount` int DEFAULT '0',
  `SeverityLevel` enum('Severe','Low','None') DEFAULT 'None',
  PRIMARY KEY (`AttractionID`),
  KEY `AreaID` (`AreaID`),
  CONSTRAINT `attraction_ibfk_1` FOREIGN KEY (`AreaID`) REFERENCES `area` (`AreaID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attraction`
--

LOCK TABLES `attraction` WRITE;
/*!40000 ALTER TABLE `attraction` DISABLE KEYS */;
/*!40000 ALTER TABLE `attraction` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`admin1`@`%`*/ /*!50003 TRIGGER `trg_ride_maintenance` AFTER UPDATE ON `attraction` FOR EACH ROW BEGIN
    DECLARE msg VARCHAR(255);

    IF NEW.Status = 'NeedsMaintenance' THEN
        IF NEW.SeverityLevel = 'Severe' THEN
            SET msg = CONCAT('Immediate maintenance required for ', NEW.AttractionName);
        ELSEIF NEW.SeverityLevel = 'Low' THEN
            SET msg = CONCAT('Maintenance scheduled for ', NEW.AttractionName, ' after severe cases');
        ELSE
            SET msg = NULL;
        END IF;

        IF msg IS NOT NULL THEN
            INSERT INTO MaintenanceAlert(AttractionID, AlertMessage)
            VALUES (NEW.AttractionID, msg);
        END IF;
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `child`
--

DROP TABLE IF EXISTS `child`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `child` (
  `ChildID` int NOT NULL AUTO_INCREMENT,
  `GuardianID` int NOT NULL,
  `Name` varchar(100) DEFAULT NULL,
  `Age` int DEFAULT NULL,
  `Gender` enum('Male','Female','Other') DEFAULT NULL,
  PRIMARY KEY (`ChildID`),
  KEY `fk_child_guardian` (`GuardianID`),
  CONSTRAINT `fk_child_guardian` FOREIGN KEY (`GuardianID`) REFERENCES `visitor` (`VisitorID`) ON DELETE CASCADE,
  CONSTRAINT `child_chk_1` CHECK (((`Age` >= 0) and (`Age` <= 17)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `child`
--

LOCK TABLES `child` WRITE;
/*!40000 ALTER TABLE `child` DISABLE KEYS */;
/*!40000 ALTER TABLE `child` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee`
--

DROP TABLE IF EXISTS `employee`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee` (
  `EmployeeID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) DEFAULT NULL,
  `Position` varchar(50) DEFAULT NULL,
  `Salary` decimal(10,2) DEFAULT NULL,
  `HireDate` date DEFAULT NULL,
  `ManagerID` int DEFAULT NULL,
  `AreaID` int DEFAULT NULL,
  PRIMARY KEY (`EmployeeID`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee`
--

LOCK TABLES `employee` WRITE;
/*!40000 ALTER TABLE `employee` DISABLE KEYS */;
INSERT INTO `employee` VALUES (1,'sam','staff',30000.00,'2023-01-01',5,101),(2,'rita','supervisor',40000.00,'2022-06-15',5,101),(3,'tom','staff',28000.00,'2023-03-10',5,102),(4,'lisa','manager assistant',35000.00,'2022-11-20',1,103);
/*!40000 ALTER TABLE `employee` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employeeperformance`
--

DROP TABLE IF EXISTS `employeeperformance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employeeperformance` (
  `PerformanceID` int NOT NULL AUTO_INCREMENT,
  `EmployeeID` int NOT NULL,
  `ReviewDate` date NOT NULL,
  `PerformanceScore` decimal(5,2) NOT NULL,
  `WorkloadNotes` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`PerformanceID`),
  KEY `idx_perf_employee` (`EmployeeID`),
  KEY `idx_perf_date` (`ReviewDate`),
  CONSTRAINT `fk_perf_employee` FOREIGN KEY (`EmployeeID`) REFERENCES `employee` (`EmployeeID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employeeperformance`
--

LOCK TABLES `employeeperformance` WRITE;
/*!40000 ALTER TABLE `employeeperformance` DISABLE KEYS */;
/*!40000 ALTER TABLE `employeeperformance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hrmanager`
--

DROP TABLE IF EXISTS `hrmanager`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hrmanager` (
  `ManagerID` int NOT NULL,
  `AreaID` int DEFAULT NULL,
  PRIMARY KEY (`ManagerID`),
  UNIQUE KEY `AreaID` (`AreaID`),
  CONSTRAINT `fk_hrmanager_area` FOREIGN KEY (`AreaID`) REFERENCES `area` (`AreaID`),
  CONSTRAINT `fk_hrmanager_manager` FOREIGN KEY (`ManagerID`) REFERENCES `manager` (`ManagerID`),
  CONSTRAINT `hrmanager_ibfk_1` FOREIGN KEY (`ManagerID`) REFERENCES `manager` (`ManagerID`),
  CONSTRAINT `hrmanager_ibfk_2` FOREIGN KEY (`AreaID`) REFERENCES `area` (`AreaID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hrmanager`
--

LOCK TABLES `hrmanager` WRITE;
/*!40000 ALTER TABLE `hrmanager` DISABLE KEYS */;
INSERT INTO `hrmanager` VALUES (5,1),(1,101);
/*!40000 ALTER TABLE `hrmanager` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `incidentreport`
--

DROP TABLE IF EXISTS `incidentreport`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `incidentreport` (
  `ReportID` int NOT NULL AUTO_INCREMENT,
  `EmployeeID` int DEFAULT NULL,
  `ReportType` enum('Broken Attraction','Stolen Item') DEFAULT NULL,
  `Description` text,
  `AttractionID` int DEFAULT NULL,
  `ItemID` int DEFAULT NULL,
  `ReportDate` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ReportID`),
  KEY `EmployeeID` (`EmployeeID`),
  CONSTRAINT `incidentreport_ibfk_1` FOREIGN KEY (`EmployeeID`) REFERENCES `employee` (`EmployeeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `incidentreport`
--

LOCK TABLES `incidentreport` WRITE;
/*!40000 ALTER TABLE `incidentreport` DISABLE KEYS */;
/*!40000 ALTER TABLE `incidentreport` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `maintenance`
--

DROP TABLE IF EXISTS `maintenance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `maintenance` (
  `MaintenanceID` int NOT NULL,
  `AttractionID` int DEFAULT NULL,
  `DateStart` date DEFAULT NULL,
  `DateEnd` date DEFAULT NULL,
  `Severity` enum('Low','Medium','High') DEFAULT NULL,
  `Status` varchar(50) DEFAULT NULL,
  `EmployeeID` int DEFAULT NULL,
  PRIMARY KEY (`MaintenanceID`),
  KEY `AttractionID` (`AttractionID`),
  KEY `EmployeeID` (`EmployeeID`),
  CONSTRAINT `maintenance_ibfk_1` FOREIGN KEY (`AttractionID`) REFERENCES `attraction` (`AttractionID`),
  CONSTRAINT `maintenance_ibfk_2` FOREIGN KEY (`EmployeeID`) REFERENCES `employee` (`EmployeeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `maintenance`
--

LOCK TABLES `maintenance` WRITE;
/*!40000 ALTER TABLE `maintenance` DISABLE KEYS */;
/*!40000 ALTER TABLE `maintenance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `maintenancealert`
--

DROP TABLE IF EXISTS `maintenancealert`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `maintenancealert` (
  `AlertID` int NOT NULL AUTO_INCREMENT,
  `AttractionID` int NOT NULL,
  `AlertMessage` varchar(255) DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `Handled` enum('Yes','No') DEFAULT 'No',
  PRIMARY KEY (`AlertID`),
  KEY `AttractionID` (`AttractionID`),
  CONSTRAINT `maintenancealert_ibfk_1` FOREIGN KEY (`AttractionID`) REFERENCES `attraction` (`AttractionID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `maintenancealert`
--

LOCK TABLES `maintenancealert` WRITE;
/*!40000 ALTER TABLE `maintenancealert` DISABLE KEYS */;
/*!40000 ALTER TABLE `maintenancealert` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `maintenanceassignment`
--

DROP TABLE IF EXISTS `maintenanceassignment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `maintenanceassignment` (
  `MaintenanceAssignmentID` int NOT NULL AUTO_INCREMENT,
  `EmployeeID` int NOT NULL,
  `AreaID` int DEFAULT NULL,
  `TaskDescription` varchar(500) NOT NULL,
  `Status` varchar(32) NOT NULL DEFAULT 'Pending',
  `DueDate` date DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`MaintenanceAssignmentID`),
  KEY `idx_maint_employee` (`EmployeeID`),
  KEY `idx_maint_area` (`AreaID`),
  KEY `idx_maint_status` (`Status`),
  CONSTRAINT `fk_maint_area` FOREIGN KEY (`AreaID`) REFERENCES `area` (`AreaID`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_maint_employee` FOREIGN KEY (`EmployeeID`) REFERENCES `employee` (`EmployeeID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `maintenanceassignment`
--

LOCK TABLES `maintenanceassignment` WRITE;
/*!40000 ALTER TABLE `maintenanceassignment` DISABLE KEYS */;
/*!40000 ALTER TABLE `maintenanceassignment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `maintenancemanager`
--

DROP TABLE IF EXISTS `maintenancemanager`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `maintenancemanager` (
  `ManagerID` int NOT NULL,
  `AreaID` int DEFAULT NULL,
  PRIMARY KEY (`ManagerID`),
  KEY `AreaID` (`AreaID`),
  CONSTRAINT `maintenancemanager_ibfk_1` FOREIGN KEY (`ManagerID`) REFERENCES `manager` (`ManagerID`),
  CONSTRAINT `maintenancemanager_ibfk_2` FOREIGN KEY (`AreaID`) REFERENCES `area` (`AreaID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `maintenancemanager`
--

LOCK TABLES `maintenancemanager` WRITE;
/*!40000 ALTER TABLE `maintenancemanager` DISABLE KEYS */;
/*!40000 ALTER TABLE `maintenancemanager` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `manager`
--

DROP TABLE IF EXISTS `manager`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manager` (
  `ManagerID` int NOT NULL,
  `ManagerName` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`ManagerID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `manager`
--

LOCK TABLES `manager` WRITE;
/*!40000 ALTER TABLE `manager` DISABLE KEYS */;
INSERT INTO `manager` VALUES (1,NULL),(5,'Scarlet Graves');
/*!40000 ALTER TABLE `manager` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notificationlog`
--

DROP TABLE IF EXISTS `notificationlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notificationlog` (
  `NotificationID` int NOT NULL AUTO_INCREMENT,
  `ManagerID` int NOT NULL,
  `ItemID` int NOT NULL,
  `Message` varchar(255) NOT NULL,
  `CreatedAt` datetime NOT NULL,
  PRIMARY KEY (`NotificationID`),
  KEY `ManagerID` (`ManagerID`),
  KEY `ItemID` (`ItemID`),
  CONSTRAINT `notificationlog_ibfk_1` FOREIGN KEY (`ManagerID`) REFERENCES `retailmanager` (`ManagerID`),
  CONSTRAINT `notificationlog_ibfk_2` FOREIGN KEY (`ItemID`) REFERENCES `retailitem` (`ItemID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notificationlog`
--

LOCK TABLES `notificationlog` WRITE;
/*!40000 ALTER TABLE `notificationlog` DISABLE KEYS */;
INSERT INTO `notificationlog` VALUES (1,1,1,'Low stock alert: Item 1 has 9 units remaining.','2026-03-28 19:12:26'),(2,1,1,'Test Item has 9 units left.','2026-03-28 19:15:00');
/*!40000 ALTER TABLE `notificationlog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `restocklog`
--

DROP TABLE IF EXISTS `restocklog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `restocklog` (
  `RestockID` int NOT NULL AUTO_INCREMENT,
  `ItemID` int NOT NULL,
  `Quantity` int NOT NULL,
  `Cost` decimal(10,2) NOT NULL,
  PRIMARY KEY (`RestockID`),
  KEY `ItemID` (`ItemID`),
  CONSTRAINT `restocklog_ibfk_1` FOREIGN KEY (`ItemID`) REFERENCES `retailitem` (`ItemID`),
  CONSTRAINT `restocklog_chk_1` CHECK ((`Quantity` > 0)),
  CONSTRAINT `restocklog_chk_2` CHECK ((`Cost` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `restocklog`
--

LOCK TABLES `restocklog` WRITE;
/*!40000 ALTER TABLE `restocklog` DISABLE KEYS */;
INSERT INTO `restocklog` VALUES (1,1,10,50.00),(2,1,10,50.00);
/*!40000 ALTER TABLE `restocklog` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`admin1`@`%`*/ /*!50003 TRIGGER `trg_RestockLog_BeforeInsert` BEFORE INSERT ON `restocklog` FOR EACH ROW BEGIN
    DECLARE v_BuyPrice DECIMAL(10,2);

    SELECT BuyPrice INTO v_BuyPrice
    FROM RetailItem
    WHERE ItemID = NEW.ItemID;

    SET NEW.Cost = v_BuyPrice * NEW.Quantity;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`admin1`@`%`*/ /*!50003 TRIGGER `trg_RestockLog_AfterInsert` AFTER INSERT ON `restocklog` FOR EACH ROW BEGIN
    UPDATE RetailItem
    SET Quantity = Quantity + NEW.Quantity
    WHERE ItemID = NEW.ItemID;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `retailitem`
--

DROP TABLE IF EXISTS `retailitem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `retailitem` (
  `ItemID` int NOT NULL AUTO_INCREMENT,
  `ItemName` varchar(100) NOT NULL,
  `BuyPrice` decimal(10,2) NOT NULL,
  `SellPrice` decimal(10,2) NOT NULL,
  `DiscountPrice` decimal(10,2) DEFAULT NULL,
  `Quantity` int NOT NULL DEFAULT '0',
  `LowStockThreshold` int NOT NULL DEFAULT '10',
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  `RetailID` int NOT NULL,
  PRIMARY KEY (`ItemID`),
  KEY `RetailID` (`RetailID`),
  CONSTRAINT `retailitem_ibfk_1` FOREIGN KEY (`RetailID`) REFERENCES `retailplace` (`RetailID`),
  CONSTRAINT `retailitem_chk_1` CHECK ((`BuyPrice` > 0)),
  CONSTRAINT `retailitem_chk_2` CHECK ((`SellPrice` >= `BuyPrice`)),
  CONSTRAINT `retailitem_chk_3` CHECK (((`DiscountPrice` is null) or ((`DiscountPrice` > 0) and (`DiscountPrice` < `SellPrice`)))),
  CONSTRAINT `retailitem_chk_4` CHECK ((`Quantity` >= 0)),
  CONSTRAINT `retailitem_chk_5` CHECK ((`LowStockThreshold` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `retailitem`
--

LOCK TABLES `retailitem` WRITE;
/*!40000 ALTER TABLE `retailitem` DISABLE KEYS */;
INSERT INTO `retailitem` VALUES (1,'Test Item',5.00,12.00,7.00,9,10,1,1),(2,'Test Item',5.00,10.00,NULL,20,10,1,1);
/*!40000 ALTER TABLE `retailitem` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`admin1`@`%`*/ /*!50003 TRIGGER `trg_RetailItem_BeforeUpdate` BEFORE UPDATE ON `retailitem` FOR EACH ROW BEGIN
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
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `retailmanager`
--

DROP TABLE IF EXISTS `retailmanager`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `retailmanager` (
  `ManagerID` int NOT NULL,
  `AreaID` int DEFAULT NULL,
  PRIMARY KEY (`ManagerID`),
  KEY `AreaID` (`AreaID`),
  CONSTRAINT `retailmanager_ibfk_1` FOREIGN KEY (`ManagerID`) REFERENCES `manager` (`ManagerID`),
  CONSTRAINT `retailmanager_ibfk_2` FOREIGN KEY (`AreaID`) REFERENCES `area` (`AreaID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `retailmanager`
--

LOCK TABLES `retailmanager` WRITE;
/*!40000 ALTER TABLE `retailmanager` DISABLE KEYS */;
INSERT INTO `retailmanager` VALUES (1,1);
/*!40000 ALTER TABLE `retailmanager` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `retailplace`
--

DROP TABLE IF EXISTS `retailplace`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `retailplace` (
  `RetailID` int NOT NULL AUTO_INCREMENT,
  `RetailName` varchar(100) NOT NULL,
  `AreaID` int NOT NULL,
  PRIMARY KEY (`RetailID`),
  UNIQUE KEY `RetailName` (`RetailName`),
  KEY `AreaID` (`AreaID`),
  CONSTRAINT `retailplace_ibfk_1` FOREIGN KEY (`AreaID`) REFERENCES `area` (`AreaID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `retailplace`
--

LOCK TABLES `retailplace` WRITE;
/*!40000 ALTER TABLE `retailplace` DISABLE KEYS */;
INSERT INTO `retailplace` VALUES (1,'Shop 1',1);
/*!40000 ALTER TABLE `retailplace` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `retailprofitreport`
--

DROP TABLE IF EXISTS `retailprofitreport`;
/*!50001 DROP VIEW IF EXISTS `retailprofitreport`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `retailprofitreport` AS SELECT 
 1 AS `RetailName`,
 1 AS `ItemName`,
 1 AS `Date`,
 1 AS `UnitsSold`,
 1 AS `Revenue`,
 1 AS `COGS`,
 1 AS `GrossProfit`,
 1 AS `GrossMarginPct`,
 1 AS `DiscountTransactions`,
 1 AS `DamagedCount`,
 1 AS `StolenCount`,
 1 AS `AreaID`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `review`
--

DROP TABLE IF EXISTS `review`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `review` (
  `ReviewID` int NOT NULL AUTO_INCREMENT,
  `VisitorID` int NOT NULL,
  `AreaID` int NOT NULL,
  `Feedback` int NOT NULL,
  `Comment` text,
  `DateSubmitted` date NOT NULL DEFAULT (curdate()),
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`ReviewID`),
  KEY `fk_review_visitor` (`VisitorID`),
  KEY `fk_review_area` (`AreaID`),
  CONSTRAINT `fk_review_area` FOREIGN KEY (`AreaID`) REFERENCES `area` (`AreaID`),
  CONSTRAINT `fk_review_visitor` FOREIGN KEY (`VisitorID`) REFERENCES `visitor` (`VisitorID`) ON DELETE CASCADE,
  CONSTRAINT `review_chk_1` CHECK ((`Feedback` between 1 and 10))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `review`
--

LOCK TABLES `review` WRITE;
/*!40000 ALTER TABLE `review` DISABLE KEYS */;
/*!40000 ALTER TABLE `review` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift`
--

DROP TABLE IF EXISTS `shift`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift` (
  `ShiftID` int NOT NULL AUTO_INCREMENT,
  `EmployeeID` int DEFAULT NULL,
  `ShiftDate` date DEFAULT NULL,
  `StartTime` time DEFAULT NULL,
  `EndTime` time DEFAULT NULL,
  PRIMARY KEY (`ShiftID`),
  KEY `EmployeeID` (`EmployeeID`),
  CONSTRAINT `shift_ibfk_1` FOREIGN KEY (`EmployeeID`) REFERENCES `employee` (`EmployeeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift`
--

LOCK TABLES `shift` WRITE;
/*!40000 ALTER TABLE `shift` DISABLE KEYS */;
/*!40000 ALTER TABLE `shift` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ticket`
--

DROP TABLE IF EXISTS `ticket`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ticket` (
  `TicketNumber` int NOT NULL AUTO_INCREMENT,
  `TicketType` enum('General','VIP','Discount') NOT NULL,
  `Price` decimal(8,2) NOT NULL,
  `IssueDate` date NOT NULL DEFAULT (curdate()),
  `ExpiryDate` date NOT NULL,
  `VisitorID` int NOT NULL,
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`TicketNumber`),
  KEY `fk_ticket_visitor` (`VisitorID`),
  CONSTRAINT `fk_ticket_visitor` FOREIGN KEY (`VisitorID`) REFERENCES `visitor` (`VisitorID`) ON DELETE CASCADE,
  CONSTRAINT `chk_ticket_dates` CHECK ((`ExpiryDate` >= `IssueDate`)),
  CONSTRAINT `ticket_chk_1` CHECK ((`Price` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ticket`
--

LOCK TABLES `ticket` WRITE;
/*!40000 ALTER TABLE `ticket` DISABLE KEYS */;
/*!40000 ALTER TABLE `ticket` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `timelog`
--

DROP TABLE IF EXISTS `timelog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `timelog` (
  `LogID` int NOT NULL AUTO_INCREMENT,
  `EmployeeID` int DEFAULT NULL,
  `ClockIn` datetime DEFAULT NULL,
  `ClockOut` datetime DEFAULT NULL,
  `HoursWorked` decimal(5,2) DEFAULT NULL,
  PRIMARY KEY (`LogID`),
  KEY `EmployeeID` (`EmployeeID`),
  CONSTRAINT `timelog_ibfk_1` FOREIGN KEY (`EmployeeID`) REFERENCES `employee` (`EmployeeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `timelog`
--

LOCK TABLES `timelog` WRITE;
/*!40000 ALTER TABLE `timelog` DISABLE KEYS */;
/*!40000 ALTER TABLE `timelog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transactionlog`
--

DROP TABLE IF EXISTS `transactionlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transactionlog` (
  `TransactionID` int NOT NULL AUTO_INCREMENT,
  `ItemID` int NOT NULL,
  `VisitorID` int NOT NULL,
  `Date` date NOT NULL,
  `Time` time NOT NULL,
  `Type` enum('Normal','Discount','Damaged','Stolen') NOT NULL,
  `Price` decimal(10,2) NOT NULL,
  `Quantity` int NOT NULL,
  `TotalCost` decimal(10,2) NOT NULL,
  PRIMARY KEY (`TransactionID`),
  KEY `ItemID` (`ItemID`),
  KEY `VisitorID` (`VisitorID`),
  CONSTRAINT `transactionlog_ibfk_1` FOREIGN KEY (`ItemID`) REFERENCES `retailitem` (`ItemID`),
  CONSTRAINT `transactionlog_ibfk_2` FOREIGN KEY (`VisitorID`) REFERENCES `visitor` (`VisitorID`),
  CONSTRAINT `transactionlog_chk_1` CHECK ((`Price` >= 0)),
  CONSTRAINT `transactionlog_chk_2` CHECK ((`Quantity` > 0)),
  CONSTRAINT `transactionlog_chk_3` CHECK ((`TotalCost` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transactionlog`
--

LOCK TABLES `transactionlog` WRITE;
/*!40000 ALTER TABLE `transactionlog` DISABLE KEYS */;
/*!40000 ALTER TABLE `transactionlog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `visitor`
--

DROP TABLE IF EXISTS `visitor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `visitor` (
  `VisitorID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) NOT NULL,
  `Phone` varchar(20) DEFAULT NULL,
  `Email` varchar(150) NOT NULL,
  `PasswordHash` varchar(255) NOT NULL,
  `Gender` enum('Male','Female','Other','Prefer not to say') DEFAULT NULL,
  `Age` int DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `IsActive` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`VisitorID`),
  UNIQUE KEY `Email` (`Email`),
  CONSTRAINT `visitor_chk_1` CHECK (((`Age` >= 0) and (`Age` <= 120)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `visitor`
--

LOCK TABLES `visitor` WRITE;
/*!40000 ALTER TABLE `visitor` DISABLE KEYS */;
/*!40000 ALTER TABLE `visitor` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `weather`
--

DROP TABLE IF EXISTS `weather`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `weather` (
  `WeatherID` int NOT NULL,
  `WeatherDate` date DEFAULT NULL,
  `HighTemp` decimal(5,2) DEFAULT NULL,
  `LowTemp` decimal(5,2) DEFAULT NULL,
  `SeverityLevel` enum('Low','Medium','High') DEFAULT NULL,
  `AttractionOperationStatus` enum('Open','Closed','Restricted') DEFAULT NULL,
  PRIMARY KEY (`WeatherID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `weather`
--

LOCK TABLES `weather` WRITE;
/*!40000 ALTER TABLE `weather` DISABLE KEYS */;
/*!40000 ALTER TABLE `weather` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`admin1`@`%`*/ /*!50003 TRIGGER `trg_weather_shutdown` AFTER INSERT ON `weather` FOR EACH ROW BEGIN
    -- High severity: close all attractions
    IF NEW.SeverityLevel = 'High' THEN
        UPDATE Attraction
        SET Status = 'ClosedDueToWeather';
        
    -- Medium severity: close only rides
    ELSEIF NEW.SeverityLevel = 'Medium' THEN
        UPDATE Attraction
        SET Status = 'ClosedDueToWeather'
        WHERE AttractionType = 'Ride';
        
    -- Low severity: no changes needed
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Dumping events for database 'newthemepark'
--

--
-- Dumping routines for database 'newthemepark'
--

--
-- Final view structure for view `activemaintenancealerts`
--

/*!50001 DROP VIEW IF EXISTS `activemaintenancealerts`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`admin1`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `activemaintenancealerts` AS select `ma`.`AlertID` AS `AlertID`,`a`.`AttractionName` AS `AttractionName`,`a`.`SeverityLevel` AS `SeverityLevel`,`ma`.`AlertMessage` AS `AlertMessage`,`ma`.`CreatedAt` AS `CreatedAt` from (`maintenancealert` `ma` join `attraction` `a` on((`ma`.`AttractionID` = `a`.`AttractionID`))) where (`ma`.`Handled` = 'No') */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `retailprofitreport`
--

/*!50001 DROP VIEW IF EXISTS `retailprofitreport`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`admin1`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `retailprofitreport` AS select `rp`.`RetailName` AS `RetailName`,`ri`.`ItemName` AS `ItemName`,`tl`.`Date` AS `Date`,sum(`tl`.`Quantity`) AS `UnitsSold`,sum(`tl`.`TotalCost`) AS `Revenue`,sum((`tl`.`Quantity` * `ri`.`BuyPrice`)) AS `COGS`,(sum(`tl`.`TotalCost`) - sum((`tl`.`Quantity` * `ri`.`BuyPrice`))) AS `GrossProfit`,round((((sum(`tl`.`TotalCost`) - sum((`tl`.`Quantity` * `ri`.`BuyPrice`))) / sum(`tl`.`TotalCost`)) * 100),2) AS `GrossMarginPct`,count((case when (`tl`.`Type` = 'Discount') then 1 end)) AS `DiscountTransactions`,count((case when (`tl`.`Type` = 'Damaged') then 1 end)) AS `DamagedCount`,count((case when (`tl`.`Type` = 'Stolen') then 1 end)) AS `StolenCount`,`rp`.`AreaID` AS `AreaID` from ((`transactionlog` `tl` join `retailitem` `ri` on((`tl`.`ItemID` = `ri`.`ItemID`))) join `retailplace` `rp` on((`ri`.`RetailID` = `rp`.`RetailID`))) where (`tl`.`Type` in ('Normal','Discount')) group by `rp`.`RetailName`,`ri`.`ItemID`,`ri`.`ItemName`,`rp`.`AreaID`,`tl`.`Date` order by `GrossProfit` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-01 13:06:45
