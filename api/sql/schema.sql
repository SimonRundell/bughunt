-- BugHunt schema (BUILD.md section 6). Table prefix bh_. InnoDB, utf8mb4.
-- bh_admins.role extends the original single-admin design: 'admin' can
-- manage other admin/teacher accounts; 'teacher' can do everything else
-- (author/verify/publish puzzles, tracks, concepts, import/export) but
-- not manage accounts. An admin is also a teacher (role is a superset,
-- not a separate flag) - role checks treat 'admin' as satisfying any
-- 'teacher'-level requirement.

CREATE TABLE bh_admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','teacher') NOT NULL DEFAULT 'teacher',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  last_login_at DATETIME NULL,
  FOREIGN KEY (created_by) REFERENCES bh_admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bh_admin_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES bh_admins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bh_login_attempts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(45) NOT NULL,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bh_tracks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  summary VARCHAR(255) NOT NULL DEFAULT '',
  intro_md TEXT NULL,
  bug_focus ENUM('syntax','runtime','logic','mixed') NOT NULL,
  assist_level ENUM('none','basic','full') NOT NULL DEFAULT 'full',
  sort_order SMALLINT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bh_concepts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  summary VARCHAR(255) NOT NULL DEFAULT '',
  lesson_md MEDIUMTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bh_puzzles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  track_id INT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  difficulty TINYINT UNSIGNED NOT NULL,            -- 1 to 5
  xp SMALLINT UNSIGNED NULL,                        -- NULL = use default for difficulty
  bug_type ENUM('syntax','runtime','logic','mixed') NOT NULL,
  brief_md TEXT NOT NULL,                           -- what the code is meant to do
  buggy_code MEDIUMTEXT NOT NULL,
  fixed_code MEDIUMTEXT NOT NULL,
  entry_mode ENUM('function','script') NOT NULL DEFAULT 'function',
  entry_name VARCHAR(64) NULL,
  explanation_md TEXT NOT NULL,
  spot_it_md TEXT NULL,
  predict_prompt_md TEXT NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  verified_hash CHAR(64) NULL,
  verified_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (track_id) REFERENCES bh_tracks(id),
  FOREIGN KEY (created_by) REFERENCES bh_admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bh_puzzle_tests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  puzzle_id INT UNSIGNED NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  label VARCHAR(160) NOT NULL,
  args_py TEXT NULL,                                -- Python literal, tuple of positional args
  kwargs_py TEXT NULL,                              -- Python literal, dict
  stdin_text TEXT NULL,
  expect_kind ENUM('returns','stdout','raises') NOT NULL,
  expect_py TEXT NOT NULL,
  compare_mode ENUM('exact','float_tol','trim_stdout','exact_stdout') NOT NULL DEFAULT 'exact',
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (puzzle_id) REFERENCES bh_puzzles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bh_hints (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  puzzle_id INT UNSIGNED NOT NULL,
  tier TINYINT UNSIGNED NOT NULL,                   -- 1 to 3
  hint_md TEXT NOT NULL,
  UNIQUE (puzzle_id, tier),
  FOREIGN KEY (puzzle_id) REFERENCES bh_puzzles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bh_puzzle_bugs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  puzzle_id INT UNSIGNED NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  line_start SMALLINT UNSIGNED NOT NULL,
  line_end SMALLINT UNSIGNED NOT NULL,
  bug_type ENUM('syntax','runtime','logic') NOT NULL,
  concept_id INT UNSIGNED NULL,
  what_md TEXT NOT NULL,                            -- what was wrong and why
  fix_md TEXT NOT NULL,                             -- how to fix it
  FOREIGN KEY (puzzle_id) REFERENCES bh_puzzles(id) ON DELETE CASCADE,
  FOREIGN KEY (concept_id) REFERENCES bh_concepts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bh_puzzle_concepts (
  puzzle_id INT UNSIGNED NOT NULL,
  concept_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (puzzle_id, concept_id),
  FOREIGN KEY (puzzle_id) REFERENCES bh_puzzles(id) ON DELETE CASCADE,
  FOREIGN KEY (concept_id) REFERENCES bh_concepts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
