import { registerAuthPaths } from "./auth";
import { registerUsersPaths } from "./users";
import { registerResidencesPaths } from "./residences";
import { registerApartmentsPaths } from "./apartments";
import { registerResidentsPaths } from "./residents";
import { registerChargesPaths } from "./charges";
import { registerPaymentsPaths } from "./payments";
import { registerExpensesPaths } from "./expenses";
import { registerIncidentsPaths } from "./incidents";
import { registerAnnouncementsPaths } from "./announcements";
import { registerMeetingsPaths } from "./meetings";
import { registerResolutionsPaths } from "./resolutions";
import { registerVotesPaths } from "./votes";
import { registerDocumentsPaths } from "./documents";
import { registerDashboardPaths } from "./dashboard";

let pathsRegistered = false;

export function registerAllPaths() {
  if (pathsRegistered) return;
  registerAuthPaths();
  registerUsersPaths();
  registerResidencesPaths();
  registerApartmentsPaths();
  registerResidentsPaths();
  registerChargesPaths();
  registerPaymentsPaths();
  registerExpensesPaths();
  registerIncidentsPaths();
  registerAnnouncementsPaths();
  registerMeetingsPaths();
  registerResolutionsPaths();
  registerVotesPaths();
  registerDocumentsPaths();
  registerDashboardPaths();
  pathsRegistered = true;
}

