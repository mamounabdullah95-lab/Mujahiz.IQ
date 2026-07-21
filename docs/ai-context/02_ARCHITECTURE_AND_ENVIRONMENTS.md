# Architecture and Environments

This document records known architectural boundaries, not an exhaustive file map. Codex must confirm actual package versions, paths, scripts, and services from the repository.

## Known stack

- TypeScript application.
- React-based web interface.
- Vite-style environment configuration and production build.
- Firebase Authentication.
- Cloud Firestore.
- Firebase Hosting.
- Firestore Rules and composite indexes.
- GitHub source control and CI.

## Main application roles

- `owner`: highest platform authority / Super Admin.
- `admin`: operational administrator.
- `buyer`: procurement-side account.
- `supplier`: supplier-side account.

`role` and `accountType` are not interchangeable:

- Privileged administration is controlled by trusted role data.
- Buyer/Supplier experience is controlled by account type and approved profile linkage.
- A normal user must not be able to self-promote or change protected account identity fields.

## Main route families

Known route families include:

- Public and authentication routes.
- Buyer workspace.
- Supplier workspace.
- Admin workspace.
- Owner / Super Admin workspace.
- Supplier directory and supplier-profile flows.
- RFQ, response, messaging, and notification flows.

Verify exact routes from the router before changing navigation or access control.

## Environment behavior

Production must fail closed:

- Missing Firebase configuration must not silently activate a Demo environment.
- Demo mode must require an explicit development/test flag.
- Production must not store credentials in local storage.
- Feature flags must have explicit, documented defaults.
- Disabled services must remain disabled unless separately approved.

## Data-access principles

- Prefer targeted Firestore queries.
- Avoid loading entire collections to perform local filtering or duplicate checks.
- Apply `orderBy`, filters, cursors, and limits in a query-safe order.
- Use pagination that covers the full dataset.
- Add composite indexes deliberately and document why they are required.
- Avoid high-frequency polling when listeners, event-driven updates, or explicit refresh are more appropriate.

## Repository inspection order

For a normal task:

1. `CODEX.md`.
2. Current baseline and safety guardrails.
3. Relevant route/component/service/rules files.
4. Direct imports and tests.
5. Broader architecture only if evidence shows the change is cross-cutting.

Do not scan generated folders, build output, backups, archived branches, `node_modules`, or temporary workspaces unless the task explicitly concerns them.
