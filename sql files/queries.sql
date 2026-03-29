

select m.managername, e.name, e.position, e.salary
from hrmanager h
join manager m on h.managerid = m.managerid
join employee e on e.managerid = h.managerid


select a.areaname, count(e.employeeid) as total_employees
from employee e
join area a on e.areaid = a.areaid
group by a.areaname;


select a.areaname, avg(e.salary) as avg_salary
from employee e
join area a on e.areaid = a.areaid
group by a.areaname;


select name, salary
from employee
order by salary desc
limit 1;


select e.name as employee, m.managername as hr_manager
from employee e
join hrmanager h on e.managerid = h.managerid
join manager m on m.managerid = h.managerid;