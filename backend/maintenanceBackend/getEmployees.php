<?php
include 'db.php';

$result = $conn->query("SELECT * FROM employee");

while($row = $result->fetch_assoc()) {
    echo "<tr>";
    echo "<td>{$row['EmployeeID']}</td>";
    echo "<td>{$row['Name']}</td>";
    echo "<td>{$row['Position']}</td>";
    echo "<td>{$row['Salary']}</td>";
    echo "<td>
        <button onclick='editEmployee({$row['EmployeeID']})'>Edit</button>
        <button onclick='deleteEmployee({$row['EmployeeID']})'>Delete</button>
    </td>";
    echo "</tr>";
}
?>