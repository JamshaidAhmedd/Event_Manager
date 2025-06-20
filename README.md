- Organiser login protected by a password (`ORGANISER_PASSWORD` env var, default `admin`).
- Manage site settings, create/edit/publish events and view all bookings.
- Bookings list is ordered by event date and then by booking ID.
- Attendees can view published events and book tickets while availability lasts.
=======
* Run ```npm run build-db``` to create the database on Mac or Linux 
or run ```npm run build-db-win``` to create the database on Windows

* Run ```npm run start``` to start serving the web app (Access via http://localhost:3000)

Test the app by browsing to the following routes:

* http://localhost:3000
* http://localhost:3000/users/list-users
* http://localhost:3000/users/add-user

You can also run: 
```npm run clean-db``` to delete the database on Mac or Linux before rebuilding it for a fresh start
```npm run clean-db-win``` to delete the database on Windows before rebuilding it for a fresh start


The application design no longer stores local binary images. The hero section
uses a CSS gradient defined in `public/main.css` so there is no need for a local
`hero.jpg` file.

##### Creating database tables #####

* All database tables should created by modifying the db_schema.sql 
* This allows us to review and recreate your database simply by running ```npm run build-db```
* Do NOT create or alter database tables through other means


#### Preparing for submission ####

Make a copy of your project folder.
In your copy, delete the following files and folders:
* node_modules
* .git (the hidden folder with your git repository)
* database.db (your database)

Make sure that your ``package.json`` file includes all of the dependencies for your project. NB. you need to use the ```--save``` tag each time you use npm to install a dependency

Edit this README.md to explain any specific instructions for setting up or using your application that you want to bring to our attention:

* remove the existing contents that we have provided
* include any settings that should be adjusted in configuration files
* include a list of the additional libraries you are using
* anything else we need to know in order to successfully run your app


NB. we will ONLY run ```npm install```, ```npm run build-db```, and ```npm run start``` . We will NOT install additional packages to run your code and will NOT run additional build scripts. Be careful with any additional node dependencies that you use.

All routes use parameterised queries and server-side validation. The interface is styled with the AdminKit template and custom CSS located in `public/main.css`.
