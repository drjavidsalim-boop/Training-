import { useState, useEffect, useCallback } from 'react';
import { Wind, Thermometer, CloudRain, MapPin, RefreshCw, AlertCircle } from 'lucide-react';

type WeatherStatus = 'idle' | 'locating' | 'fetching' | 'success' | 'error';

export default function AeroPaceV4() {
  const [raceDist, setRaceDist] = useState(10);
  const [raceMins, setRaceMins] = useState(40);
  const [raceSecs, setRaceSecs] = useState(0);

  const [temp, setTemp] = useState(15);
  const [humidity, setHumidity] = useState(50);
  const [windSpeed, setWindSpeed] = useState(16);
  const [windDir, setWindDir] = useState(0);
  const [runDir, setRunDir] = useState(0);

  const [thresholdBase, setThresholdBase] = useState(0);
  const [finalTarget, setFinalTarget] = useState(0);
  const [workoutPaces, setWorkoutPaces] = useState({ ten: "", six: "", three: "", tempo: "" });

  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>('idle');
  const [weatherError, setWeatherError] = useState('');
  const [locationName, setLocationName] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  useEffect(() => {
    const totalRaceSecs = (Number(raceMins) * 60) + Number(raceSecs);
    const racePace = totalRaceSecs / Number(raceDist);

    let tBase = racePace;
    if (Number(raceDist) <= 5) tBase += 28;
    else if (Number(raceDist) <= 10) tBase += 16;
    else if (Number(raceDist) >= 21) tBase -= 4;
    setThresholdBase(tBase);

    const tempF = (Number(temp) * 1.8) + 32;
    const climateFactor = tempF + Number(humidity);
    let climateSlowdown = 1.0;
    if (climateFactor > 110) climateSlowdown = 1.01;
    if (climateFactor > 130) climateSlowdown = 1.03;
    if (climateFactor > 150) climateSlowdown = 1.06;

    const angleDiff = (Number(windDir) - Number(runDir)) * (Math.PI / 180);
    const effectiveWind = Number(windSpeed) * Math.cos(angleDiff);
    let windAdjustment = 0;
    if (effectiveWind > 0) {
      windAdjustment = effectiveWind * 1.025;
    } else {
      windAdjustment = effectiveWind * 0.466;
    }

    const applyEnv = (base: number) => (base * climateSlowdown) + windAdjustment;
    setFinalTarget(applyEnv(tBase));

    setWorkoutPaces({
      ten: formatPace(applyEnv(tBase / 0.98)),
      six: formatPace(applyEnv(tBase)),
      three: formatPace(applyEnv(tBase / 1.03)),
      tempo: formatPace(applyEnv(tBase / 0.88))
    });
  }, [raceDist, raceMins, raceSecs, temp, humidity, windSpeed, windDir, runDir]);

  const fetchWeather = useCallback(() => {
    if (!navigator.geolocation) {
      setWeatherStatus('error');
      setWeatherError('Geolocation is not supported by your browser.');
      return;
    }

    setWeatherStatus('locating');
    setWeatherError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setWeatherStatus('fetching');

        try {
          const [weatherRes, geoRes] = await Promise.all([
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=auto`
            ),
            fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            ),
          ]);

          if (!weatherRes.ok) throw new Error('Weather fetch failed');
          const weatherData = await weatherRes.json();
          const current = weatherData.current;

          setTemp(Math.round(current.temperature_2m));
          setHumidity(Math.round(current.relative_humidity_2m));
          setWindSpeed(Math.round(current.wind_speed_10m));

          // Snap wind direction to nearest 45° increment
          const rawDeg = current.wind_direction_10m;
          const snapped = Math.round(rawDeg / 45) % 8;
          setWindDir(snapped * 45);

          // Location name from reverse geocode
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const city =
              geoData.address?.city ||
              geoData.address?.town ||
              geoData.address?.village ||
              geoData.address?.county ||
              'Your location';
            setLocationName(city);
          }

          setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          setWeatherStatus('success');
        } catch {
          setWeatherStatus('error');
          setWeatherError('Could not fetch weather data. Please try again.');
        }
      },
      (err) => {
        setWeatherStatus('error');
        if (err.code === 1) {
          setWeatherError('Location access denied. Enable it in your browser settings.');
        } else {
          setWeatherError('Could not determine your location. Please try again.');
        }
      },
      { timeout: 10000 }
    );
  }, []);

  function formatPace(secs: number) {
    if (!secs || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    marginTop: '6px',
    background: 'transparent',
    color: 'white',
    border: 'none',
    outline: 'none',
    fontSize: '1.4rem',
    fontWeight: '700',
    fontFamily: 'inherit',
  };

  const cardStyle: React.CSSProperties = {
    background: '#0f172a',
    padding: '14px',
    borderRadius: '14px',
    border: '1px solid #1e293b',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.65rem',
    color: '#94a3b8',
    letterSpacing: '0.08em',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
  };

  const isLoading = weatherStatus === 'locating' || weatherStatus === 'fetching';

  return (
    <div style={{ background: '#020617', color: '#f8fafc', minHeight: '100vh', padding: '18px 16px 32px', fontFamily: "'Inter', system-ui, sans-serif", maxWidth: '480px', margin: '0 auto' }}>

      {/* Header */}
      <header style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <h1 style={{ color: '#38bdf8', fontSize: '1.3rem', fontWeight: '800', letterSpacing: '0.05em', margin: 0 }}>AERO-PACE</h1>
            <span style={{ fontSize: '0.65rem', color: '#38bdf8', opacity: 0.6, fontWeight: '700', letterSpacing: '0.12em' }}>V4</span>
          </div>
          <p style={{ fontSize: '0.65rem', color: '#475569', letterSpacing: '0.12em', fontWeight: '600', marginTop: '2px' }}>ENVIRONMENTAL ADAPTIVE ENGINE</p>
        </div>

        {/* Live Weather Button */}
        <button
          onClick={fetchWeather}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: weatherStatus === 'success' ? '#0c4a2e' : '#0f172a',
            border: `1px solid ${weatherStatus === 'success' ? '#16a34a' : weatherStatus === 'error' ? '#dc2626' : '#334155'}`,
            color: weatherStatus === 'success' ? '#4ade80' : weatherStatus === 'error' ? '#f87171' : '#94a3b8',
            padding: '7px 12px',
            borderRadius: '10px',
            fontSize: '0.65rem',
            fontWeight: '700',
            letterSpacing: '0.06em',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: isLoading ? 0.7 : 1,
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
          }}
        >
          {isLoading ? (
            <>
              <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
              {weatherStatus === 'locating' ? 'LOCATING...' : 'FETCHING...'}
            </>
          ) : (
            <>
              <MapPin size={11} />
              {weatherStatus === 'success' ? 'LIVE' : 'USE MY LOCATION'}
            </>
          )}
        </button>
      </header>

      {/* Location Banner */}
      {weatherStatus === 'success' && locationName && (
        <div style={{
          background: '#0c4a2e',
          border: '1px solid #16a34a',
          borderRadius: '10px',
          padding: '8px 12px',
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={11} color="#4ade80" />
            <span style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: '700' }}>{locationName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.6rem', color: '#166534' }}>Updated {lastUpdated}</span>
            <button
              onClick={fetchWeather}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', display: 'flex', color: '#4ade80' }}
            >
              <RefreshCw size={11} />
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {weatherStatus === 'error' && (
        <div style={{
          background: '#450a0a',
          border: '1px solid #dc2626',
          borderRadius: '10px',
          padding: '8px 12px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <AlertCircle size={13} color="#f87171" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.68rem', color: '#f87171' }}>{weatherError}</span>
        </div>
      )}

      {/* Race Performance */}
      <div style={{ ...cardStyle, marginBottom: '12px' }}>
        <div style={labelStyle}>Recent Race Performance</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
          <select
            value={raceDist}
            onChange={e => setRaceDist(Number(e.target.value))}
            style={{ flex: 1, background: '#1e293b', color: 'white', border: '1px solid #334155', padding: '10px 8px', borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
          >
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="21.1">Half Marathon</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '6px 10px' }}>
            <input
              type="number"
              value={raceMins}
              onChange={e => setRaceMins(Number(e.target.value))}
              style={{ width: '38px', textAlign: 'center', background: 'transparent', color: 'white', border: 'none', outline: 'none', fontSize: '1rem', fontWeight: '700', fontFamily: 'inherit' }}
            />
            <span style={{ color: '#475569', fontWeight: '700' }}>:</span>
            <input
              type="number"
              value={raceSecs}
              onChange={e => setRaceSecs(Number(e.target.value))}
              style={{ width: '38px', textAlign: 'center', background: 'transparent', color: 'white', border: 'none', outline: 'none', fontSize: '1rem', fontWeight: '700', fontFamily: 'inherit' }}
              min={0}
              max={59}
            />
          </div>
        </div>
      </div>

      {/* Climate Data */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        <div style={{ ...cardStyle, position: 'relative' }}>
          {weatherStatus === 'success' && <LiveDot />}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', ...labelStyle }}>
            <Thermometer size={12} /> Temp °C
          </div>
          <input
            type="number"
            value={temp}
            onChange={e => setTemp(Number(e.target.value))}
            style={inputStyle}
          />
          <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '2px' }}>{((Number(temp) * 1.8) + 32).toFixed(0)}°F</div>
        </div>
        <div style={{ ...cardStyle, position: 'relative' }}>
          {weatherStatus === 'success' && <LiveDot />}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', ...labelStyle }}>
            <CloudRain size={12} /> Humidity %
          </div>
          <input
            type="number"
            value={humidity}
            onChange={e => setHumidity(Number(e.target.value))}
            style={inputStyle}
            min={0}
            max={100}
          />
          <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '2px' }}>
            {Number(temp) > 25 && Number(humidity) > 70 ? '⚠ High heat index' : 'Normal range'}
          </div>
        </div>
      </div>

      {/* Wind Speed */}
      <div style={{ ...cardStyle, marginBottom: '12px', position: 'relative' }}>
        {weatherStatus === 'success' && <LiveDot />}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', ...labelStyle, marginBottom: '10px' }}>
          <Wind size={12} /> Wind Speed (kph)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="range"
            min="0"
            max="64"
            step="1"
            value={windSpeed}
            onChange={e => setWindSpeed(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#38bdf8' }}
          />
          <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#38bdf8', minWidth: '48px', textAlign: 'right' }}>
            {windSpeed}<span style={{ fontSize: '0.7rem', color: '#64748b' }}> kph</span>
          </span>
        </div>
      </div>

      {/* Wind Direction */}
      <div style={{ ...cardStyle, marginBottom: '12px', position: 'relative' }}>
        {weatherStatus === 'success' && <LiveDot />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={labelStyle}>Wind From</span>
          <span style={{ ...labelStyle, color: '#38bdf8' }}>{directions[Number(windDir) / 45]}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px' }}>
          {directions.map((d, i) => (
            <button
              key={d}
              onClick={() => setWindDir(i * 45)}
              style={{
                background: Number(windDir) === i * 45 ? '#0ea5e9' : '#1e293b',
                border: Number(windDir) === i * 45 ? '1px solid #38bdf8' : '1px solid #334155',
                color: Number(windDir) === i * 45 ? 'white' : '#94a3b8',
                fontSize: '0.62rem',
                fontWeight: '700',
                padding: '6px 2px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Run Direction */}
      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={labelStyle}>Run Heading</span>
          <span style={{ ...labelStyle, color: '#f59e0b' }}>{directions[Number(runDir) / 45]}</span>
        </div>
        <input
          type="range"
          min="0"
          max="315"
          step="45"
          value={runDir}
          onChange={e => setRunDir(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#f59e0b' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          {directions.map(d => (
            <span key={d} style={{ fontSize: '0.55rem', color: '#475569', fontWeight: '600' }}>{d}</span>
          ))}
        </div>
      </div>

      {/* Main Target */}
      <div style={{
        background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
        padding: '20px',
        borderRadius: '16px',
        textAlign: 'center',
        marginBottom: '12px',
        border: '1px solid #3b82f6',
        boxShadow: '0 0 40px rgba(59,130,246,0.15)',
      }}>
        <div style={{ fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
          Adjusted Threshold Pace
        </div>
        <div style={{ fontSize: '3.2rem', fontWeight: '900', lineHeight: 1.1, marginTop: '6px', letterSpacing: '-0.02em' }}>
          {formatPace(finalTarget)}
          <span style={{ fontSize: '1rem', fontWeight: '400', color: 'rgba(255,255,255,0.6)', marginLeft: '4px' }}>/km</span>
        </div>
        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', marginTop: '6px', letterSpacing: '0.08em' }}>
          BASE: {formatPace(thresholdBase)}/km
        </div>
      </div>

      {/* Workout Presets */}
      <div style={{ ...cardStyle }}>
        <div style={{ fontSize: '0.65rem', color: '#38bdf8', letterSpacing: '0.1em', fontWeight: '700', textTransform: 'uppercase', marginBottom: '12px' }}>
          Environmental Workouts
        </div>
        <div style={{ display: 'grid', gap: '0' }}>
          {[
            { label: '10 min Sub-Threshold', value: workoutPaces.ten, intensity: '98%' },
            { label: '6 min Sub-Threshold', value: workoutPaces.six, intensity: '100%' },
            { label: '3 min Sub-Threshold', value: workoutPaces.three, intensity: '103%' },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid #1e293b',
              }}
            >
              <div>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{item.label}</div>
                <div style={{ fontSize: '0.6rem', color: '#475569', marginTop: '1px' }}>{item.intensity} intensity</div>
              </div>
              <strong style={{ fontSize: '1rem', color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
                {item.value}<span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '400' }}>/km</span>
              </strong>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#fbbf24' }}>Tempo Range</div>
              <div style={{ fontSize: '0.6rem', color: '#475569', marginTop: '1px' }}>88% of threshold</div>
            </div>
            <strong style={{ fontSize: '0.9rem', color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>
              {workoutPaces.tempo}
            </strong>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.6rem', color: '#1e293b', letterSpacing: '0.08em' }}>
        AERO-PACE V4 · VDOT-STYLE THRESHOLD · HADLEY CLIMATE MODEL · OPEN-METEO WEATHER
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

function LiveDot() {
  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      width: '7px',
      height: '7px',
      borderRadius: '50%',
      background: '#4ade80',
      animation: 'pulse 2s ease-in-out infinite',
    }} />
  );
}
