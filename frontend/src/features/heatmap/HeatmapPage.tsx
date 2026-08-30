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

  useEffect(() => {
    if (!userId) return;
    getHeatmap(userId)
      .then(r => {
        const map = new Map<string, number>();
        r.data.days.forEach((d: HeatmapDay) => map.set(d.date, d.completionPercentage));
        setHeatmapData(map);
      })
      .catch(() => { /* keep empty map */ });
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