<?php
include 'db.php';

$name = $_POST['name'];
$position = $_POST['position'];
$salary = $_POST['salary'];
$hireDate = $_POST['hireDate'];
$areaID = $_POST['areaID'];

$sql = "INSERT INTO employee (Name, Position, Salary, HireDate, AreaID)
        VALUES ('$name', '$position', '$salary', '$hireDate', '$areaID')";

if ($conn->query($sql) === TRUE) {
    echo "Employee added!";
} else {
    echo "Error: " . $conn->error;
}
?>