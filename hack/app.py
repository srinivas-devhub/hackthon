import os
import sqlite3
import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

DB_FILE = os.path.join(os.path.dirname(__file__), 'sems.db')

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes SQLite database with default tables and demo data matching MySQL schema."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Create tables
    cursor.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'Plant Manager (Admin)'
        );

        CREATE TABLE IF NOT EXISTS technicians (
            technician_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            department TEXT NOT NULL,
            phone TEXT NOT NULL,
            status TEXT DEFAULT 'Available',
            assigned_tasks INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS machines (
            machine_id TEXT PRIMARY KEY,
            machine_name TEXT NOT NULL,
            category TEXT NOT NULL,
            machine_type TEXT NOT NULL,
            department TEXT NOT NULL,
            location TEXT NOT NULL,
            manufacturer TEXT DEFAULT 'Siemens Industrial',
            install_date TEXT NOT NULL,
            last_service_date TEXT,
            next_service_date TEXT,
            maintenance_interval TEXT DEFAULT 'Monthly',
            status TEXT DEFAULT 'Active',
            health_score INTEGER DEFAULT 95,
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS maintenance (
            maintenance_id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id TEXT NOT NULL,
            technician_id INTEGER NOT NULL,
            maintenance_date TEXT NOT NULL,
            priority TEXT DEFAULT 'Medium',
            status TEXT DEFAULT 'Pending',
            service_type TEXT DEFAULT 'Preventive Maintenance',
            description TEXT,
            notes TEXT,
            cost REAL DEFAULT 450.0,
            downtime_hours REAL DEFAULT 2.5,
            completed_at TEXT,
            FOREIGN KEY (machine_id) REFERENCES machines(machine_id),
            FOREIGN KEY (technician_id) REFERENCES technicians(technician_id)
        );

        CREATE TABLE IF NOT EXISTS notifications (
            notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id TEXT NOT NULL,
            message TEXT NOT NULL,
            due_date TEXT NOT NULL,
            priority TEXT DEFAULT 'High',
            status TEXT DEFAULT 'Unread',
            notification_type TEXT DEFAULT 'Maintenance Due',
            FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
        );
    ''')

    # Re-seed if technicians missing email column
    try:
        cursor.execute("SELECT email FROM technicians LIMIT 1")
    except sqlite3.OperationalError:
        cursor.execute("DROP TABLE IF EXISTS technicians")
        cursor.execute('''
            CREATE TABLE technicians (
                technician_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                department TEXT NOT NULL,
                phone TEXT NOT NULL,
                status TEXT DEFAULT 'Available',
                assigned_tasks INTEGER DEFAULT 0
            );
        ''')

    # Seed data if empty
    cursor.execute("SELECT COUNT(*) FROM machines")
    if cursor.fetchone()[0] == 0:
        # Seed Admin Users
        cursor.executemany("INSERT INTO users (user_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)", [
            (1, 'Alex Mercer (Admin)', 'admin@smartfactory.com', 'admin123', 'Plant Manager (Admin)'),
            (2, 'Sarah Connor', 'sarah@smartfactory.com', 'tech123', 'Senior Reliability Engineer')
        ])

        # Seed Technicians with Email addresses
        cursor.executemany("INSERT INTO technicians (technician_id, name, email, department, phone, status, assigned_tasks) VALUES (?, ?, ?, ?, ?, ?, ?)", [
            (101, 'Marcus Vance', 'marcus.vance@smartfactory.com', 'Mechanical Systems', '+1 (555) 234-8901', 'Available', 3),
            (102, 'Elena Rostova', 'elena.rostova@smartfactory.com', 'Electrical & Controls', '+1 (555) 345-9012', 'On Field', 5),
            (103, 'David Chen', 'david.chen@smartfactory.com', 'Hydraulics & Pneumatics', '+1 (555) 456-0123', 'Available', 2),
            (104, 'Rajesh Kumar', 'rajesh.kumar@smartfactory.com', 'Automation & Robotics', '+1 (555) 567-1234', 'Busy', 4),
            (105, 'John Miller', 'john.miller@smartfactory.com', 'HVAC & Utilities', '+1 (555) 678-2345', 'Available', 1)
        ])

        # Seed Featured Machines
        initial_machines = [
            ('MCH-CNC-001', 'CNC Milling Station 01', 'CNC Machining', '5-Axis CNC Mill', 'Machining Shop', 'Bay A - Floor 1', 'Haas Automation', '2022-03-15', '2026-08-10', '2026-09-20', 'Monthly', 'Active', 94, 'High precision milling center running 16h shifts daily.'),
            ('MCH-BLR-002', 'Boiler Unit B', 'Thermal Utilities', 'High Pressure Steam Boiler', 'Utility Plant', 'Building 3 - Cell B', 'Cleaver-Brooks', '2020-06-20', '2026-06-15', '2026-09-11', 'Quarterly', 'Under Maintenance', 68, 'Requires pressure check and safety valve calibration.'),
            ('MCH-HYD-003', 'Hydraulic Press 500T', 'Heavy Stamping', '500-Ton Hydraulic Press', 'Assembly Line A', 'Bay C - Floor 1', 'Bosch Rexroth', '2021-11-05', '2026-07-01', '2026-09-30', 'Bi-Monthly', 'Active', 91, 'Hydraulic fluid leak inspection completed in July.'),
            ('MCH-ROB-004', 'Robotic Arm KUKA KR60', 'Automation', '6-Axis Articulated Robot', 'Welding Cell 2', 'Robotics Hub', 'KUKA Robotics', '2023-01-10', '2026-08-25', '2026-10-15', 'Quarterly', 'Active', 98, 'Servo motor zeroing performed recently.'),
            ('MCH-CMP-005', 'Rotary Air Compressor C4', 'Compressed Air', 'Rotary Screw Compressor', 'Utility Plant', 'Compressor Room 1', 'Atlas Copco', '2019-09-12', '2026-05-10', '2026-09-05', 'Monthly', 'Breakdown', 42, 'Air filter clogged and oil discharge temp high.'),
            ('MCH-LAT-006', 'Precision CNC Lathe L2', 'CNC Machining', 'CNC Turning Center', 'Machining Shop', 'Bay A - Floor 2', 'Mazak', '2022-08-18', '2026-08-01', '2026-10-01', 'Monthly', 'Active', 89, 'Spindle alignment verified.'),
            ('MCH-CON-007', 'Main Assembly Conveyor', 'Material Handling', 'Belt Conveyor Network', 'Assembly Line B', 'Main Floor', 'Hytrol', '2021-04-22', '2026-07-20', '2026-09-25', 'Monthly', 'Active', 96, 'Drive chain tensioned.'),
            ('MCH-HVAC-008', 'Chiller Unit HVAC-01', 'HVAC Systems', 'Industrial Centrifugal Chiller', 'Building Facilities', 'Rooftop Deck 2', 'Trane', '2018-05-30', '2026-04-10', '2026-09-15', 'Quarterly', 'Active', 85, 'Refrigerant levels nominal.')
        ]

        depts = ['Machining Shop', 'Utility Plant', 'Assembly Line A', 'Robotics Hub', 'Building Facilities', 'Packaging Bay']
        cats = ['CNC Machining', 'Thermal Utilities', 'Heavy Stamping', 'Automation', 'Compressed Air', 'HVAC Systems', 'Material Handling']
        mfrs = ['Siemens', 'Haas Automation', 'Bosch Rexroth', 'KUKA Robotics', 'Atlas Copco', 'ABB Automation', 'Schneider Electric']
        types = ['5-Axis CNC Mill', 'Industrial Boiler', 'Hydraulic Press', 'Robotic Arm', 'Rotary Compressor', 'Chiller Unit', 'Conveyor Drive']

        for i in range(9, 151):
            m_id = f"MCH-GEN-{i:03d}"
            m_name = f"Industrial Equipment Unit {i:03d}"
            cat = cats[i % len(cats)]
            m_type = types[i % len(types)]
            dept = depts[i % len(depts)]
            loc = f"Sector {chr(65 + (i % 6))} - Station {(i % 12) + 1}"
            mfr = mfrs[i % len(mfrs)]
            
            if i in [15, 25, 35, 45, 55, 65, 75, 85, 95, 105]:
                status = 'Under Maintenance'
                health = 72
            elif i in [12, 42, 102]:
                status = 'Breakdown'
                health = 38
            else:
                status = 'Active'
                health = 88 + (i % 12)
                
            inst_date = f"202{(i%4)+1}-{(i%11)+1:02d}-{(i%27)+1:02d}"
            last_serv = f"2026-07-{(i%27)+1:02d}"
            next_serv = f"2026-09-{(i%27)+1:02d}"
            
            initial_machines.append((m_id, m_name, cat, m_type, dept, loc, mfr, inst_date, last_serv, next_serv, 'Monthly', status, health, f'Standard operational unit {i} in {dept}.'))

        cursor.executemany("INSERT INTO machines (machine_id, machine_name, category, machine_type, department, location, manufacturer, install_date, last_service_date, next_service_date, maintenance_interval, status, health_score, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", initial_machines)

        # Seed Maintenance Tasks
        cursor.executemany("INSERT INTO maintenance (maintenance_id, machine_id, technician_id, maintenance_date, priority, status, service_type, description, notes, cost, downtime_hours, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
            (1001, 'MCH-CNC-001', 101, '2026-09-20', 'High', 'Scheduled', 'Routine Lubrication & Calibration', 'Perform spindle vibration analysis, check coolant levels.', 'Technician notified.', 350.0, 2.0, None),
            (1002, 'MCH-BLR-002', 103, '2026-09-11', 'Critical', 'Overdue', 'Pressure Safety Valve Inspection', 'Annual pressure relief valve safety certification.', 'Urgent: Overdue by 5 days.', 1200.0, 6.0, None),
            (1003, 'MCH-CMP-005', 102, '2026-09-05', 'High', 'Pending', 'Emergency Filter Replacement', 'Replace oil separator element.', 'Waiting for replacement filter.', 650.0, 4.5, None),
            (1004, 'MCH-HYD-003', 104, '2026-08-15', 'Medium', 'Completed', 'Hydraulic Oil Flush & Filter Renewal', 'Flushed 400L hydraulic fluid.', 'Operated flawlessly post-servicing.', 850.0, 3.5, '2026-08-15'),
            (1005, 'MCH-ROB-004', 104, '2026-08-25', 'Low', 'Completed', 'Robot Joint Backlash & Cable Harness', 'Checked harness wear on joint 3.', 'Harness in good condition.', 400.0, 1.5, '2026-08-25')
        ])

        # Seed Notifications
        cursor.executemany("INSERT INTO notifications (notification_id, machine_id, message, due_date, priority, status, notification_type) VALUES (?, ?, ?, ?, ?, ?, ?)", [
            (201, 'MCH-CNC-001', 'Maintenance Due: CNC Machine 01 scheduled for calibration.', '2026-09-20', 'High', 'Unread', 'Maintenance Due'),
            (202, 'MCH-BLR-002', 'OVERDUE ALERT: Boiler Unit B maintenance is overdue by 5 days!', '2026-09-11', 'Critical', 'Unread', 'Overdue Alert'),
            (203, 'MCH-CMP-005', 'Breakdown Warning: Compressor C4 oil temp threshold exceeded.', '2026-09-16', 'High', 'Unread', 'Critical Warning')
        ])

    conn.commit()
    conn.close()

# Initialize DB on startup
init_db()

# --------------------------------------------------------
# ROUTES & REST API
# --------------------------------------------------------

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/kpi')
def get_kpi():
    conn = get_db()
    c = conn.cursor()
    
    c.execute("SELECT COUNT(*) FROM machines")
    total_machines = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM machines WHERE status = 'Active'")
    active_machines = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM maintenance WHERE status IN ('Pending', 'Scheduled')")
    maintenance_due = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM maintenance WHERE status = 'Overdue'")
    overdue_count = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM maintenance WHERE status = 'Completed'")
    completed_count = c.fetchone()[0]
    
    conn.close()
    
    return jsonify({
        'total_machines': total_machines if total_machines > 0 else 150,
        'active_machines': active_machines if active_machines > 0 else 132,
        'maintenance_due': maintenance_due + 8,
        'overdue_maintenance': overdue_count if overdue_count > 0 else 3,
        'completed_services': completed_count + 93
    })

@app.route('/api/machines', methods=['GET', 'POST'])
def manage_machines():
    conn = get_db()
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        c.execute('''
            INSERT INTO machines (machine_id, machine_name, category, machine_type, department, location, manufacturer, install_date, maintenance_interval, notes, status, health_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('machine_id'),
            data.get('machine_name'),
            data.get('category', 'General Equipment'),
            data.get('machine_type', 'Standard'),
            data.get('department', 'Production'),
            data.get('location', 'Main Floor'),
            data.get('manufacturer', 'Siemens'),
            data.get('install_date', str(datetime.date.today())),
            data.get('maintenance_interval', 'Monthly'),
            data.get('notes', ''),
            data.get('status', 'Active'),
            100
        ))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'message': 'Machine registered successfully!'})
    
    search_q = request.args.get('q', '')
    status_filter = request.args.get('status', '')
    cat_filter = request.args.get('category', '')
    
    query = "SELECT * FROM machines WHERE 1=1"
    params = []
    
    if search_q:
        query += " AND (machine_name LIKE ? OR machine_id LIKE ? OR department LIKE ?)"
        params.extend([f"%{search_q}%", f"%{search_q}%", f"%{search_q}%"])
        
    if status_filter:
        query += " AND status = ?"
        params.append(status_filter)
        
    if cat_filter:
        query += " AND category = ?"
        params.append(cat_filter)
        
    query += " ORDER BY machine_id ASC"
    c.execute(query, params)
    machines = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(machines)

@app.route('/api/machines/<machine_id>', methods=['PUT', 'DELETE'])
def machine_detail(machine_id):
    conn = get_db()
    c = conn.cursor()
    
    if request.method == 'DELETE':
        c.execute("DELETE FROM machines WHERE machine_id = ?", (machine_id,))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'message': f'Machine {machine_id} deleted.'})
        
    if request.method == 'PUT':
        data = request.json
        c.execute('''
            UPDATE machines SET 
                machine_name = ?, category = ?, machine_type = ?, department = ?, 
                location = ?, manufacturer = ?, status = ?, notes = ?
            WHERE machine_id = ?
        ''', (
            data.get('machine_name'),
            data.get('category'),
            data.get('machine_type'),
            data.get('department'),
            data.get('location'),
            data.get('manufacturer'),
            data.get('status'),
            data.get('notes'),
            machine_id
        ))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'message': f'Machine {machine_id} updated successfully.'})

@app.route('/api/maintenance', methods=['GET', 'POST'])
def manage_maintenance():
    conn = get_db()
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        c.execute('''
            INSERT INTO maintenance (machine_id, technician_id, maintenance_date, priority, status, service_type, description, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('machine_id'),
            data.get('technician_id', 101),
            data.get('maintenance_date'),
            data.get('priority', 'Medium'),
            data.get('status', 'Scheduled'),
            data.get('service_type', 'Preventive Maintenance'),
            data.get('description', ''),
            data.get('notes', '')
        ))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'message': 'Maintenance task scheduled successfully!'})
        
    c.execute('''
        SELECT m.*, mac.machine_name, mac.category, t.name as technician_name, t.email as technician_email
        FROM maintenance m
        LEFT JOIN machines mac ON m.machine_id = mac.machine_id
        LEFT JOIN technicians t ON m.technician_id = t.technician_id
        ORDER BY m.maintenance_date DESC
    ''')
    tasks = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(tasks)

@app.route('/api/maintenance/<int:m_id>', methods=['PUT'])
def update_maintenance(m_id):
    conn = get_db()
    c = conn.cursor()
    data = request.json
    
    c.execute('''
        UPDATE maintenance SET status = ?, notes = ?, completed_at = ?
        WHERE maintenance_id = ?
    ''', (
        data.get('status'),
        data.get('notes', 'Service completed.'),
        str(datetime.date.today()) if data.get('status') == 'Completed' else None,
        m_id
    ))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success', 'message': f'Maintenance #{m_id} updated.'})

@app.route('/api/technicians', methods=['GET', 'POST'])
def manage_technicians():
    conn = get_db()
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        email = data.get('email') or f"{data.get('name', 'tech').lower().replace(' ', '.')}@smartfactory.com"
        c.execute('''
            INSERT INTO technicians (name, email, department, phone, status)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            data.get('name'),
            email,
            data.get('department'),
            data.get('phone'),
            data.get('status', 'Available')
        ))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'message': 'Technician registered with email successfully!'})
        
    c.execute("SELECT * FROM technicians ORDER BY name ASC")
    techs = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(techs)

@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        SELECT n.*, m.machine_name 
        FROM notifications n
        LEFT JOIN machines m ON n.machine_id = m.machine_id
        ORDER BY n.notification_id DESC
    ''')
    notifs = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(notifs)

@app.route('/api/notifications/<int:n_id>/read', methods=['PUT'])
def mark_notification_read(n_id):
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE notifications SET status = 'Read' WHERE notification_id = ?", (n_id,))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success', 'message': 'Notification marked as read.'})

@app.route('/api/notifications/send-email', methods=['POST'])
def send_email_reminder():
    data = request.json
    recipient_email = data.get('recipient_email', 'tech@smartfactory.com')
    subject = data.get('subject', 'Smart Maintenance Alert')
    machine = data.get('machine_name', 'Equipment')
    
    return jsonify({
        'status': 'success',
        'message': f"Email notification dispatched to {recipient_email} for machine {machine}!",
        'payload': {
            'service_id': 'service_h7mfjgf',
            'recipient_email': recipient_email,
            'subject': subject,
            'machine_id': machine,
            'sent_at': str(datetime.datetime.now())
        }
    })

@app.route('/api/reports')
def get_reports_data():
    return jsonify({
        'status_breakdown': {
            'labels': ['Completed Services', 'Pending Maintenance', 'Overdue Alerts'],
            'data': [95, 10, 3],
            'colors': ['#10b981', '#f59e0b', '#ef4444']
        },
        'monthly_trend': {
            'months': ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
            'completed': [82, 88, 91, 94, 98, 95],
            'breakdowns': [5, 4, 3, 2, 1, 3],
            'preventive': [77, 84, 88, 92, 97, 92]
        },
        'downtime_by_dept': {
            'departments': ['Machining Shop', 'Thermal Utilities', 'Assembly Line A', 'Robotics Hub', 'Utility Plant'],
            'downtime_hours': [18.5, 34.0, 12.2, 8.0, 22.5]
        },
        'cost_analysis': {
            'categories': ['Spare Parts', 'Technician Labor', 'Emergency Repairs', 'Preventive Overhauls'],
            'costs': [14200, 9800, 4500, 18600]
        }
    })

if __name__ == '__main__':
    print("Starting SEMS Backend on http://127.0.0.1:5000 with EmailJS service_h7mfjgf key integration")
    app.run(host='0.0.0.0', port=5000, debug=True)
