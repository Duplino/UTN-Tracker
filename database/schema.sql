-- UTN-Tracker: esquema relacional (MySQL 8.0+, InnoDB, utf8mb4)
-- El plan de estudios (carreras/módulos/materias/correlativas) vive acá también
-- (tablas careers/career_modules/subjects/career_subjects/subject_requirements),
-- ya no en JSON estático. Las materias son un catálogo GLOBAL compartido entre
-- carreras: los resultados (enrollments) se linkean a la materia, no a la carrera.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- USERS
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  google_sub VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NULL,
  avatar_url VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_google_sub (google_sub)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  UNIQUE KEY uq_user_sessions_token_hash (token_hash),
  KEY idx_user_sessions_user_id (user_id),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- CAREERS / PLAN DE ESTUDIOS
-- =====================================================

CREATE TABLE IF NOT EXISTS careers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  has_intermediate_title TINYINT(1) NOT NULL DEFAULT 0,
  intermediate_title_name VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_careers_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS career_modules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  career_id INT UNSIGNED NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  display_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  electives_slots TINYINT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_career_modules (career_id, code),
  KEY idx_career_modules_career_id (career_id),
  CONSTRAINT fk_career_modules_career FOREIGN KEY (career_id) REFERENCES careers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Catálogo GLOBAL de materias, compartido entre carreras (ej. Análisis Matemático I
-- aprobada cuenta para cualquier carrera que la incluya).
CREATE TABLE IF NOT EXISTS subjects (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  week_hours TINYINT UNSIGNED NOT NULL DEFAULT 6,
  duration ENUM('anual','cuatrimestral') NOT NULL DEFAULT 'anual',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subjects_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dónde vive cada materia dentro de una carrera (módulo, si es electiva, si es
-- solo para el título intermedio, si cuenta como requisito del título intermedio).
CREATE TABLE IF NOT EXISTS career_subjects (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  career_id INT UNSIGNED NOT NULL,
  module_id INT UNSIGNED NULL,
  subject_id INT UNSIGNED NOT NULL,
  is_elective TINYINT(1) NOT NULL DEFAULT 0,
  only_for_intermediate TINYINT(1) NOT NULL DEFAULT 0,
  required_for_intermediate_title TINYINT(1) NOT NULL DEFAULT 0,
  display_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_career_subjects (career_id, subject_id),
  KEY idx_career_subjects_module_id (module_id),
  CONSTRAINT fk_career_subjects_career FOREIGN KEY (career_id) REFERENCES careers(id) ON DELETE CASCADE,
  CONSTRAINT fk_career_subjects_module FOREIGN KEY (module_id) REFERENCES career_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_career_subjects_subject FOREIGN KEY (subject_id) REFERENCES subjects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Correlativas: career_subject_id es la materia "para la cual" es requisito;
-- required_subject_id es la materia requerida (global, no atada a una carrera:
-- el cumplimiento se evalúa sobre el estado global de esa materia).
CREATE TABLE IF NOT EXISTS subject_requirements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  career_subject_id INT UNSIGNED NOT NULL,
  required_subject_id INT UNSIGNED NOT NULL,
  requirement_kind ENUM('cursar','aprobar') NOT NULL,
  status_type ENUM('regularizada','aprobada') NOT NULL DEFAULT 'aprobada',
  KEY idx_subject_requirements_career_subject_id (career_subject_id),
  CONSTRAINT fk_subject_requirements_career_subject FOREIGN KEY (career_subject_id) REFERENCES career_subjects(id) ON DELETE CASCADE,
  CONSTRAINT fk_subject_requirements_required_subject FOREIGN KEY (required_subject_id) REFERENCES subjects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- USER PREFERENCES / CAREERS / ELECTIVES
-- =====================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INT UNSIGNED PRIMARY KEY,
  active_career_id INT UNSIGNED NULL,
  show_correlativas TINYINT(1) NOT NULL DEFAULT 1,
  show_status TINYINT(1) NOT NULL DEFAULT 1,
  view_mode VARCHAR(20) NOT NULL DEFAULT 'board',
  selected_stats JSON NULL,
  year_started SMALLINT NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  share_token CHAR(32) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_preferences_share_token (share_token),
  CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_preferences_career FOREIGN KEY (active_career_id) REFERENCES careers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- En qué carreras está anotado un usuario (controla qué aparece en el dropdown);
-- darse de baja borra esta fila nada más, nunca las inscripciones/resultados.
CREATE TABLE IF NOT EXISTS user_careers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  career_id INT UNSIGNED NOT NULL,
  show_intermediate_title TINYINT(1) NOT NULL DEFAULT 0,
  enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_careers (user_id, career_id),
  KEY idx_user_careers_user_id (user_id),
  CONSTRAINT fk_user_careers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_careers_career FOREIGN KEY (career_id) REFERENCES careers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_electives (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  career_id INT UNSIGNED NOT NULL,
  subject_id INT UNSIGNED NOT NULL,
  column_index TINYINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_electives (user_id, career_id, subject_id),
  CONSTRAINT fk_user_electives_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_electives_career FOREIGN KEY (career_id) REFERENCES careers(id),
  CONSTRAINT fk_user_electives_subject FOREIGN KEY (subject_id) REFERENCES subjects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- EVALUATION SCHEMES
-- =====================================================

CREATE TABLE IF NOT EXISTS evaluation_schemes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  config JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_evaluation_schemes_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- ENROLLMENTS (linkeadas a la MATERIA, no a la carrera)
-- =====================================================

CREATE TABLE IF NOT EXISTS enrollments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  subject_id INT UNSIGNED NOT NULL,
  evaluation_scheme_id INT UNSIGNED NOT NULL,
  enrollment_year SMALLINT NOT NULL,
  -- Legacy: el conteo de recursadas ya no vive acá (ver subject_retakes más abajo),
  -- porque "recursar" borra esta fila entera y el conteo tiene que sobrevivir a eso.
  -- Se deja la columna para no romper filas viejas; código nuevo no la lee/escribe.
  recursed_count INT UNSIGNED NOT NULL DEFAULT 0,
  status_override VARCHAR(20) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_enrollments_user_subject (user_id, subject_id),
  KEY idx_enrollments_user_id (user_id),
  CONSTRAINT fk_enrollments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_enrollments_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
  CONSTRAINT fk_enrollments_scheme FOREIGN KEY (evaluation_scheme_id) REFERENCES evaluation_schemes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Conteo de recursadas por (usuario, materia): independiente de `enrollments` a
-- propósito, porque "recursar" y "dar de baja" borran la inscripción activa, pero
-- el número de cursada tiene que sobrevivir a eso (se sigue mostrando en la
-- tarjeta aunque la materia vuelva a verse "disponible para cursar").
CREATE TABLE IF NOT EXISTS subject_retakes (
  user_id INT UNSIGNED NOT NULL,
  subject_id INT UNSIGNED NOT NULL,
  recursed_count INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, subject_id),
  CONSTRAINT fk_subject_retakes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_subject_retakes_subject FOREIGN KEY (subject_id) REFERENCES subjects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS enrollment_partials (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT UNSIGNED NOT NULL,
  partial_number TINYINT UNSIGNED NOT NULL,
  attempt_number TINYINT UNSIGNED NOT NULL,
  grade TINYINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_enrollment_partials (enrollment_id, partial_number, attempt_number),
  KEY idx_enrollment_partials_enrollment_id (enrollment_id),
  CONSTRAINT fk_enrollment_partials_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  CONSTRAINT chk_enrollment_partials_grade CHECK (grade IS NULL OR (grade BETWEEN 1 AND 10))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS enrollment_finals (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT UNSIGNED NOT NULL,
  attempt_number TINYINT UNSIGNED NOT NULL,
  grade TINYINT UNSIGNED NULL,
  exam_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_enrollment_finals (enrollment_id, attempt_number),
  KEY idx_enrollment_finals_enrollment_id (enrollment_id),
  CONSTRAINT fk_enrollment_finals_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  CONSTRAINT chk_enrollment_finals_grade CHECK (grade IS NULL OR (grade BETWEEN 1 AND 10))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS enrollment_checklist (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT UNSIGNED NOT NULL,
  item_type ENUM('tp','lab') NOT NULL,
  item_number TINYINT UNSIGNED NOT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  UNIQUE KEY uq_enrollment_checklist (enrollment_id, item_type, item_number),
  KEY idx_enrollment_checklist_enrollment_id (enrollment_id),
  CONSTRAINT fk_enrollment_checklist_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
