# ThemeParkDatabase

ThemeParkDatabase is a multi-portal theme park management project with:
- a MySQL database schema and seed scripts
- several Node.js backend services (admin, employee, HR, maintenance, retail, homepage, visitor)
- static frontend portals (homepage, admin, employee, HR, maintenance, visitor)

This README is written as a full setup manual so someone downloading the project cold can run it.

## 1) Files Being Submitted

### Root files
- `README.md` - this installation and project guide
- `package.json` / `package-lock.json` - root-level Node dependencies
- `vercel.json` - rewrite rules for frontend route mapping in Vercel
- `.gitignore` - ignored files list

### Database files (`sql files/`)
- `sql files/Dump20260401.sql` - main SQL dump / base dataset
- `sql files/queries.sql` - reference SQL queries
- `sql files/retail_schema.sql` - retail schema updates
- `sql files/retail_triggers.sql` - retail-related triggers
- `sql files/retail_view.sql` - retail SQL views
- `sql files/homepage_users_seed.sql` - homepage/login-related seed users
- `sql files/admin_seed_employee_hr_manger_visitors.sql` - admin/employee/HR/visitor seed data
- `sql files/hr_portal_activites.sql` - HR portal activity tables/data
- `sql files/visitor_ticket_type_migration.sql` - visitor ticket type migration
- `sql files/visitor_views_and_triggers.sql` - visitor views and trigger logic
- `sql files/visitor_portal_feature_upgrade.sql` - visitor feature upgrade changes
- `sql files/visitor_portal_area_content_seed.sql` - visitor area content seed data
- `sql files/visitor_presentation_seed_mysql.sql` - optional presentation/demo seed data

### Backend folders (`backend/`)
- `backend/adminBackend/` - admin portal API and reporting backend
- `backend/employeebackend/` - employee portal API backend
- `backend/hrmanager/` - HR manager backend routes and APIs
- `backend/homepageBackend/` - homepage/auth backend
- `backend/maintenanceBackend/` - maintenance portal backend
- `backend/retailbackend/` - retail backend and static retail frontend under `public/retailfront/`
- `backend/visitorbackend/` - visitor API, auth, and seeding scripts

### Frontend folders (`frontend/`)
- `frontend/homepageFrontend/` - homepage UI
- `frontend/adminFrontend/` - admin portal UI
- `frontend/employeefrontend/` - employee portal UI
- `frontend/hrfrontend/` - HR portal UI
- `frontend/maintenanceFrontend/` - maintenance portal UI
- `frontend/visitorfrontend/` - visitor portal UI
- `frontend/src/` - shared frontend helper modules

## 2) Software Requirements

Install these first:
- Node.js 18+ (Node 20 LTS recommended)
- npm (comes with Node)
- MySQL 8.0+ (MySQL Workbench recommended for importing `.sql` files)
- A browser (Chrome/Edge/Firefox)

## 3) Step-by-Step Installation and Run Instructions (Render + Vercel)

### Step 1: Download project files
1. Download or clone the project.
2. If you downloaded a zip, unzip it.
3. Open the project folder:
   - `ThemeParkDatabase/`

### Step 2: Create the MySQL database
1. Open MySQL Workbench (or mysql CLI).
2. Create a database (example):
   - `newthemepark`
3. Select/use that database.

### Step 3: Import SQL files
Run/import SQL files in this order to avoid missing-table/view errors:

1. `sql files/Dump20260401.sql`
2. `sql files/retail_schema.sql`
3. `sql files/retail_triggers.sql`
4. `sql files/retail_view.sql`
5. `sql files/homepage_users_seed.sql`
6. `sql files/admin_seed_employee_hr_manger_visitors.sql`
7. `sql files/hr_portal_activites.sql`
8. `sql files/visitor_ticket_type_migration.sql`
9. `sql files/visitor_views_and_triggers.sql`
10. `sql files/visitor_portal_feature_upgrade.sql`
11. `sql files/visitor_portal_area_content_seed.sql`
12. (Optional demo data) `sql files/visitor_presentation_seed_mysql.sql`

### Step 4: Configure backend environment variables on Render
Create one Render Web Service per backend folder:
- `backend/adminBackend`
- `backend/employeebackend`
- `backend/hrmanager`
- `backend/homepageBackend`
- `backend/maintenanceBackend`
- `backend/retailbackend`
- `backend/visitorbackend`

For each Render service:
1. Set the root directory to the backend folder.
2. Build command: `npm install`
3. Start command: `npm start`
4. Add environment variables (DB host/user/password/database, JWT secrets, CORS/frontend origin where needed).

Use the same MySQL database credentials across all services so every portal uses the same data.

### Step 5: Deploy backend services to Render
1. Push code to your GitHub repo.
2. Connect the repo to Render.
3. Deploy each backend service.
4. Confirm each service has a live Render URL (for example: `https://your-service-name.onrender.com`).

### Step 6: Deploy frontend to Vercel
1. Import this repository into Vercel.
2. Keep `vercel.json` rewrite rules enabled.
3. Deploy the project.
4. Confirm the Vercel production URL loads the homepage and portal routes:
   - `/`
   - `/admin`
   - `/employee`
   - `/hr`
   - `/maintenance`
   - `/visitor`

### Step 7: Verify frontend API endpoints
Frontend files already reference deployed Render backend URLs. Verify the URLs are correct in:
- `frontend/visitorfrontend/app.js`
- `frontend/maintenanceFrontend/app.js`
- `frontend/maintenanceFrontend/portal.js`
- `frontend/hrfrontend/app.js`
- `frontend/adminFrontend/index.html` (`admin-api-origin` meta tag)
- `frontend/homepageFrontend/main.js`

If a backend URL changes, update it in the corresponding frontend file and redeploy on Vercel.

## 4) Typical Deployment Checklist

1. MySQL database created and SQL files imported
2. All backend services deployed on Render
3. Render environment variables are configured correctly
4. Frontend deployed on Vercel with `vercel.json` rewrites
5. Frontend routes load correctly
6. Frontend API calls to Render backends succeed

## 5) Notes / Special Requirements

- Requires internet for some external CDN assets/fonts used by frontend pages.
- Requires Node.js 18+ for modern syntax and backend compatibility.
- Keep JWT secrets and DB credentials private (do not commit `.env` files).
