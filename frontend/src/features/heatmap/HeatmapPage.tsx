import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getHeatmap } from '../../api/habitApi';
import type { HeatmapDay } from '../../api/habitApi';
import Navbar from '../../components/Navbar';
import HeatmapView from '../../components/HeatmapView';

const HeatmapPage = () => {
  const { userId } = useAuth();
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());

  const today = new Date();

  const generateMockData = (): Map<string, number> => {
    const map = new Map<string, number>();
    for (let d = 0; d < 365 * 3; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const key = date.toISOString().split('T')[0];
      if (Math.random() > 0.3) map.set(key, Math.ceil(Math.random() * 100)); // percentages up to 100%
    }
    return map;
  };

  useEffect(() => {
    if (!userId) return;
    getHeatmap(userId)
      .then(r => {
        const map = new Map<string, number>();
        r.data.days.forEach((d: HeatmapDay) => map.set(d.date, d.completionPercentage));
        setHeatmapData(map);
      })
      .catch(() => setHeatmapData(generateMockData()));
  }, [userId]);

  return (
    <div className="min-h-screen" style={{ background: '#1a1a18' }}>
      <Navbar />
      <div className="py-8">
        <HeatmapView heatmapData={heatmapData} title="My consistency" />
      </div>
    </div>
  );
};

export default HeatmapPage;