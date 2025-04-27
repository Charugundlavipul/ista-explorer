// src/App.js

import React, { useState, useEffect } from 'react'
import { supabase }      from './supabaseClient'
import { DataGrid }      from '@mui/x-data-grid'
import {
  Button, Box, CircularProgress, Typography,
  Paper, Chip, Stack, Grid, Tabs, Tab, Collapse
} from '@mui/material'
import { useSnackbar }   from 'notistack'
import MonacoEditor      from 'react-monaco-editor'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line
} from 'recharts'

const SAMPLE_QUERIES = [
  { label: 'List 10 Tourists', sql: 'SELECT * FROM ista.tourist LIMIT 10;' },
  { label: 'Upcoming Missions', sql:
    `SELECT m.mission_id, p.name AS planet, m.departure_date
FROM ista.mission m
JOIN ista.planet p ON m.planet_id=p.planet_id
WHERE m.departure_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 year'
ORDER BY m.departure_date;`
  },
  { label: 'Bookings by Planet', sql:
    `SELECT p.name AS planet, COUNT(*) AS total_bookings
FROM ista.booking b
JOIN ista.mission m ON b.mission_id=m.mission_id
JOIN ista.planet p ON m.planet_id=p.planet_id
GROUP BY p.name
ORDER BY total_bookings DESC;`
  },
  { label: 'Crew >3 Missions', sql:
    `SELECT c.name, COUNT(*) AS missions
FROM ista.crewassignment ca
JOIN ista.crewmember c ON ca.crew_id=c.crew_id
GROUP BY c.name
HAVING COUNT(*)>3
ORDER BY missions DESC;`
  },
  { label: 'Maintenance Logs', sql:
    `SELECT ml.log_id, s.model, ml.log_date
FROM ista.maintenancelog ml
JOIN ista.spacecraft s ON ml.spacecraft_id=s.spacecraft_id
ORDER BY ml.log_date DESC
LIMIT 5;`
  }
]

export default function App() {
  const [tab, setTab]           = useState(0)
  const [sql, setSql]           = useState(SAMPLE_QUERIES[0].sql)
  const [rows, setRows]         = useState([])
  const [columns, setColumns]   = useState([])
  const [loading, setLoading]   = useState(false)
  const { enqueueSnackbar }     = useSnackbar()

  // dashboard state
  const [bookingsByPlanet, setBookingsByPlanet] = useState([])
  const [missionsByMonth, setMissionsByMonth]   = useState([])
  const [crewByRole, setCrewByRole]             = useState([])
  const [touristAgeDist, setTouristAgeDist]     = useState([])

  // insight panel state
  const [insightOpen, setInsightOpen]   = useState(false)
  const [insightTitle, setInsightTitle] = useState('')
  const [insightText, setInsightText]   = useState('')

  // fetch dashboard metrics once
  useEffect(() => {
    ;(async () => {
      // 1) Bookings by Planet
      let { data: bp } = await supabase.rpc('execute_sql_json',{ sql_text:
        `SELECT p.name AS planet, COUNT(*) AS total_bookings
 FROM ista.booking b
 JOIN ista.mission m ON b.mission_id=m.mission_id
 JOIN ista.planet p ON m.planet_id=p.planet_id
 GROUP BY p.name
 ORDER BY total_bookings DESC;`
      })
      if (Array.isArray(bp)) {
        setBookingsByPlanet(bp.map(r=>({
          planet: r.planet,
          total_bookings: r.total_bookings
        })))
      }

      // 2) Missions per Month
      let { data: mm } = await supabase.rpc('execute_sql_json',{ sql_text:
        `SELECT to_char(DATE_TRUNC('month', departure_date),'YYYY-MM') AS month,
   COUNT(*) AS missions
 FROM ista.mission
 GROUP BY 1
 ORDER BY 1;`
      })
      if (Array.isArray(mm)) {
        setMissionsByMonth(mm.map(r=>({
          month: r.month,
          missions: r.missions
        })))
      }

      // 3) Crew Assignments by Role
      let { data: cr } = await supabase.rpc('execute_sql_json',{ sql_text:
        `SELECT cm.role, COUNT(ca.assignment_id) AS assignments
 FROM ista.crewassignment ca
 JOIN ista.crewmember cm ON ca.crew_id=cm.crew_id
 GROUP BY cm.role
 ORDER BY assignments DESC;`
      })
      if (Array.isArray(cr)) {
        setCrewByRole(cr.map(r=>({
          role: r.role,
          assignments: r.assignments
        })))
      }

      // 4) Tourist Ages by Decade
      let { data: ad } = await supabase.rpc('execute_sql_json',{ sql_text:
        `SELECT floor(date_part('year', age(dob))/10)*10 AS decade,
   COUNT(*) AS count
 FROM ista.tourist
 GROUP BY 1
 ORDER BY 1;`
      })
      if (Array.isArray(ad)) {
        setTouristAgeDist(ad.map(r=>({
          decade: `${r.decade}s`,
          count: r.count
        })))
      }
    })()
  }, [])

  // run custom user query
  const runQuery = async () => {
    const t = sql.trim()
    if (!/^SELECT/i.test(t)) {
      enqueueSnackbar('Only SELECT allowed',{variant:'warning'})
      return
    }
    setLoading(true)
    const { data: jr, error } = await supabase.rpc('execute_sql_json',{ sql_text:t })
    setLoading(false)
    if (error) {
      enqueueSnackbar(error.message,{variant:'error'})
      return
    }
    const data = Array.isArray(jr)?jr:jr?[]:[]
    if (data.length === 0) {
      setRows([]); setColumns([])
      enqueueSnackbar('No rows returned',{variant:'info'})
      return
    }
    const cols = Object.keys(data[0]).map(f=>({ field:f, headerName:f, flex:1 }))
    setColumns(cols)
    setRows(data.map((r,i)=>( { id:i, ...r } )))
  }

  // show insight panel
  const showInsight = (title, text) => {
    setInsightTitle(title)
    setInsightText(text)
    setInsightOpen(true)
  }

  return (
    <Box sx={{ p:3, height:'100vh', display:'flex', flexDirection:'column' }}>
      <Typography variant="h3" sx={{ color:'#66ccff', fontFamily:'Orbitron' }} gutterBottom>
        ISTA Explorer
      </Typography>

      <Tabs value={tab} onChange={(_, v)=>setTab(v)} sx={{ mb:2 }}>
        <Tab label="Query" />
        <Tab label="Dashboard" />
      </Tabs>

      {tab===0 && (
        <>
          <Paper sx={{ mb:2, p:2 }} elevation={4}>
            <Typography variant="h6">Sample Queries</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {SAMPLE_QUERIES.map((q,i)=>
                <Chip
                  key={i}
                  label={q.label}
                  onClick={()=>setSql(q.sql)}
                  clickable
                  color="secondary"
                  sx={{ mb:1 }}
                />
              )}
              {/* Custom Query Chip */}
              <Chip
                label="Custom Query"
                onClick={()=>setSql('')}
                clickable
                color="primary"
                sx={{ mb:1 }}
              />
            </Stack>
          </Paper>

          <Paper sx={{ mb:2, p:1 }} elevation={4}>
            <MonacoEditor
              width="100%"
              height="180"
              language="sql"
              theme="vs-dark"
              value={sql}
              options={{ automaticLayout:true, minimap:{ enabled:false } }}
              onChange={setSql}
            />
          </Paper>

          <Button
            variant="contained"
            onClick={runQuery}
            disabled={loading}
            startIcon={loading && <CircularProgress size={16} color="inherit" />}
            sx={{ mb:2, width:120 }}
          >
            Run
          </Button>

          <Paper sx={{ flex:1, p:1 }} elevation={4}>
            {columns.length > 0 ? (
              <DataGrid
                rows={rows}
                columns={columns}
                pagination
                initialState={{
                  pagination:{ paginationModel:{ page:0, pageSize:10 }}
                }}
                pageSizeOptions={[5,10,20,50,100]}
                sx={{ background:'#0b0b1b' }}
              />
            ) : (
              <Typography color="textSecondary">No results</Typography>
            )}
          </Paper>
        </>
      )}

      {tab===1 && (
        <>
          <Grid container spacing={2} sx={{ flex:1, overflow:'auto' }}>
            {/* Crew by Role */}
            <Grid item xs={12} md={6} lg={4}>
              <Paper
                sx={{ p:2, cursor:'pointer' }}
                elevation={4}
                onClick={()=>showInsight(
                  'Crew Assignments by Role',
                  `Guides top the team with 819 assignments, highlighting their leadership and guest support on each mission. Medics follow at 796, ensuring passenger safety and health. Pilots handle 737 assignments, steering our spacecraft through the stars. Engineers, with 648 assignments, keep every system running smoothly. This balanced mix of roles ensures that each mission meets the highest standards of safety, comfort, and reliability for our space travelers.`
                )}
              >
                <Typography variant="h6">Crew Assignments by Role</Typography>
                <BarChart width={300} height={200} data={crewByRole}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="role" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="assignments" fill="#ff8042" />
                </BarChart>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => showInsight(
                    'Crew Assignments by Role',
                    `Guides top the team with 819 assignments, highlighting their leadership and guest support on each mission. Medics follow at 796, ensuring passenger safety and health. Pilots handle 737 assignments, steering our spacecraft through the stars. Engineers, with 648 assignments, keep every system running smoothly. This balanced mix of roles ensures that each mission meets the highest standards of safety, comfort, and reliability for our space travelers.`
                  )}
                  sx={{ mt:1 }}
                >
                  View Insight
                </Button>
              </Paper>
            </Grid>

            {/* Tourist Ages by Decade */}
            <Grid item xs={12} md={6} lg={4}>
              <Paper
                sx={{ p:2, cursor:'pointer' }}
                elevation={4}
                onClick={()=>showInsight(
                  'Tourist Ages by Decade',
                  `Most ISTA travelers are in their 40s, with roughly 875 adventurers exploring space at mid-career. Those in their 20s and 30s follow close behind which is showing strong youthful curiosity. The 50s group has about 450 participants. Seniors in their 60s make up around 45 explorers. Understanding these age trends helps ISTA design personalized experiences—whether it’s health checks, cabin comfort, or mission briefings which are specific to each life stage.`
                )}
              >
                <Typography variant="h6">Tourist Ages by Decade</Typography>
                <BarChart width={300} height={200} data={touristAgeDist}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="decade" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#00C49F" />
                </BarChart>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => showInsight(
                    'Tourist Ages by Decade',
                   `Most ISTA travelers are in their 40s, with roughly 875 adventurers exploring space at mid-career. Those in their 20s and 30s follow close behind which is showing strong youthful curiosity. The 50s group has about 450 participants. Seniors in their 60s make up around 45 explorers. Understanding these age trends helps ISTA design personalized experiences—whether it’s health checks, cabin comfort, or mission briefings which are specific to each life stage.`
                  )}
                  sx={{ mt:1 }}
                >
                  View Insight
                </Button>
              </Paper>
            </Grid>

            {/* Bookings by Planet */}
            <Grid item xs={12} md={6} lg={4}>
              <Paper
                sx={{ p:2, cursor:'pointer' }}
                elevation={4}
                onClick={()=>showInsight(
                  'Bookings by Planet',
                  `Mars-jn18 and Proxima b-ag46 lead with 10 bookings each, Close behind, Kepler-452b and other Proxima sites each register nine reservations whichhigh lights interest in exotic worlds. A handful of other planets see seven or eight passengers, showing a healthy spread of curiosity. These insights guide ISTA’s route planning, ensuring we allocate spacecraft and crew where demand is highest while still offering adventures to these destinations.`
                )}
              >
                <Typography variant="h6">Bookings by Planet</Typography>
                <BarChart width={300} height={200} data={bookingsByPlanet}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="planet" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total_bookings" fill="#66ccff" />
                </BarChart>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => showInsight(
                    'Bookings by Planet',
                    `Mars-jn18 and Proxima b-ag46 lead with 10 bookings each, Close behind, Kepler-452b and other Proxima sites each register nine reservations whichhigh lights interest in exotic worlds. A handful of other planets see seven or eight passengers, showing a healthy spread of curiosity. These insights guide ISTA’s route planning, ensuring we allocate spacecraft and crew where demand is highest while still offering adventures to these destinations.`
                  )}
                  sx={{ mt:1 }}
                >
                  View Insight
                </Button>
              </Paper>
            </Grid>

            {/* Missions per Month */}
            <Grid item xs={12} md={6} lg={4}>
              <Paper
                sx={{ p:2, cursor:'pointer' }}
                elevation={4}
                onClick={()=>showInsight(
                  'Missions per Month',
                  `ISTA’s monthly launches jump from about 50 up to a reliable 120–150 which shows rapid growth and consistent demand. That steady plateau holds across seasons which suggests smooth fleet maintenance and scheduling. We see a slight dip near the period’s end, perhaps due to planned upgrades or seasonal factors. These patterns let ISTA optimize crew rosters, timetable maintenance windows, and plan promotions so every journey remains safe.`
                )}
              >
                <Typography variant="h6">Missions per Month</Typography>
                <LineChart width={300} height={200} data={missionsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="missions" stroke="#ff66ff" dot={false} />
                </LineChart>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => showInsight(
                    'Missions per Month',
                    `ISTA’s monthly launches jump from about 50 up to a reliable 120–150 which shows rapid growth and consistent demand. That steady plateau holds across seasons which suggests smooth fleet maintenance and scheduling. We see a slight dip near the period’s end, perhaps due to planned upgrades or seasonal factors. These patterns let ISTA optimize crew rosters, timetable maintenance windows, and plan promotions so every journey remains safe.`
                  )}
                  sx={{ mt:1 }}
                >
                  View Insight
                </Button>
              </Paper>
            </Grid>
          </Grid>

          {/* Insights panel (only on dashboard) */}
          <Collapse in={insightOpen}>
            <Paper sx={{ mt:2, p:2, background:'#111' }} elevation={3}>
              <Typography variant="h6" sx={{ color:'#66ccff' }}>
                {insightTitle}
              </Typography>
              <Typography sx={{ mt:1, color:'#ddd' }}>
                {insightText}
              </Typography>
            </Paper>
          </Collapse>
        </>
      )}
    </Box>
  )
}
