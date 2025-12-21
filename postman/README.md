Postman notes
- Character Service seeds two classes on startup: Warrior and Rogue.
- To get `classId`, either:
  - query DB: `SELECT id, name FROM classes;` (character_db), or
  - use any UUID from your own inserted class if you extend endpoints later.

(Keeping Postman simple for evaluation; service behavior is the focus.)
