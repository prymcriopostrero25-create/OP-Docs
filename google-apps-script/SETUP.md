# Role access setup

In CREDENTIALS, keep B = EMAIL, C = NAME, D = PASSWORD and add E = ROLE.
Use `user`, `admin`, or `super admin`. Blank or unknown roles receive user access.

Deploy the updated Code.gs as a new version of the existing Apps Script web app, then sign out and sign in again to load the role and session token. Log and account requests require a server-issued session (up to six hours); the server rechecks the current sheet role on each request.

Users can create draft documents. Admins can create documents and change status. Super admins additionally have Archive, Activity log, User management, User logs, and Settings access. The recent activity panel is also restricted to super admins.

Document creation and status updates use in-memory sample records and reset on reload; the project has no document persistence API. Activity log content is also sample data. Any future document API must enforce these permissions on the server.
