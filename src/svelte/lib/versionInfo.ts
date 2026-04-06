export type VersionHistoryEntry = {
  version: string;
  date: string;
  summary: string;
};

// Update this file manually when you want to document changes between builds.
export const VERSION_INFO = {
  currentVersion: "2.0",
  history: [
    {
      version: "2.0",
      date: "2026-04-02",
      summary: `Complete rewrite with (1) recipient tracking, (2) optional loading templates from Gmail drafts, (3) a UI for
        sending test messages, and an improved user interface.`,
    },
    {
      version: "1.0",
      date: "2017-10-26",
      summary:
        "KISS Email basic mail merge: unlimited email merging with simple template editing all in Sheets. Configuration saved to a hidden Google Sheet, making it easily extensible and transparent.",
    },
  ] satisfies VersionHistoryEntry[],
} as const;
