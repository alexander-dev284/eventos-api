-- Esquema inicial y datos semilla (migrado desde schema.sql)

-- =========================================================
-- MÓDULO DE SEGURIDAD (Autenticación y Autorización)
-- =========================================================

CREATE TABLE IF NOT EXISTS roles (
    rol_id SERIAL PRIMARY KEY,
    rol_nombre VARCHAR(50) NOT NULL UNIQUE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_rol_nombre ON roles(rol_nombre);

CREATE TABLE IF NOT EXISTS funciones (
    fun_id SERIAL PRIMARY KEY,
    fun_nombre VARCHAR(100) NOT NULL UNIQUE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_funciones_fun_nombre ON funciones(fun_nombre);

-- Tabla intermedia para el menú dinámico
CREATE TABLE IF NOT EXISTS roles_funciones (
    rof_rol_id INT NOT NULL,
    rof_fun_id INT NOT NULL,
    PRIMARY KEY (rof_rol_id, rof_fun_id),
    FOREIGN KEY (rof_rol_id) REFERENCES roles(rol_id) ON DELETE CASCADE,
    FOREIGN KEY (rof_fun_id) REFERENCES funciones(fun_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_funciones_rol_fun ON roles_funciones(rof_rol_id, rof_fun_id);

CREATE TABLE IF NOT EXISTS usuarios (
    usu_id SERIAL PRIMARY KEY,
    usu_username VARCHAR(100) NOT NULL UNIQUE,
    usu_password VARCHAR(255) NOT NULL,
    usu_rol_id INT NOT NULL,
    FOREIGN KEY (usu_rol_id) REFERENCES roles(rol_id) ON DELETE RESTRICT
);

-- =========================================================
-- MÓDULO DE NEGOCIO (Gestión de Eventos)
-- =========================================================

CREATE TABLE IF NOT EXISTS asistentes (
    asi_id SERIAL PRIMARY KEY,
    asi_identificacion VARCHAR(50) NOT NULL UNIQUE,
    asi_nombre VARCHAR(200) NOT NULL,
    asi_email VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS eventos (
    eve_id SERIAL PRIMARY KEY,
    eve_nombre VARCHAR(200) NOT NULL,
    eve_fecha_inicio TIMESTAMP NOT NULL,
    eve_capacidad INT NOT NULL,
    eve_ubicacion VARCHAR(255),
    eve_estado VARCHAR(50) DEFAULT 'Activo'
);

CREATE TABLE IF NOT EXISTS registro_evento (
    reg_id SERIAL PRIMARY KEY,
    reg_fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reg_asi_id INT NOT NULL,
    FOREIGN KEY (reg_asi_id) REFERENCES asistentes(asi_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS asistencias (
    ase_id SERIAL PRIMARY KEY,
    ase_reg_id INT NOT NULL,
    ase_eve_id INT NOT NULL,
    ase_estado VARCHAR(50) DEFAULT 'Inscrito',
    FOREIGN KEY (ase_reg_id) REFERENCES registro_evento(reg_id) ON DELETE CASCADE,
    FOREIGN KEY (ase_eve_id) REFERENCES eventos(eve_id) ON DELETE RESTRICT
);

-- =========================================================
-- DATOS SEMILLA (SEEDS)
-- =========================================================

INSERT INTO roles (rol_nombre) VALUES ('Admin'), ('Operativo')
ON CONFLICT (rol_nombre) DO NOTHING;

INSERT INTO funciones (fun_nombre) VALUES 
('CRUD Asistentes'),
('CRUD Eventos'),
('Registro Transaccional'),
('Reportes'),
('CRUD Usuarios'),
('CRUD Roles')
ON CONFLICT (fun_nombre) DO NOTHING;

INSERT INTO roles_funciones (rof_rol_id, rof_fun_id) 
SELECT 1, fun_id FROM funciones WHERE fun_nombre IN ('CRUD Asistentes', 'CRUD Eventos', 'Registro Transaccional', 'Reportes', 'CRUD Usuarios', 'CRUD Roles')
ON CONFLICT DO NOTHING;

INSERT INTO usuarios (usu_username, usu_password, usu_rol_id) VALUES
('admin', 'admin123', 1),
('operador', '123456', 2)
ON CONFLICT (usu_username) DO NOTHING;
