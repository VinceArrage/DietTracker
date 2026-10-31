import { TabBar } from './components/TabBar';
import { DayView, History } from './screens/History';
import PlanScreen from './screens/Plan';
import Settings from './screens/Settings';
import Today from './screens/Today';
import { useHashRoute } from './ui/useHashRoute';

export default function App() {
  const route = useHashRoute();
  return (
    <>
      <main className="app">
        {route.name === 'today' && <Today />}
        {route.name === 'plan' && <PlanScreen />}
        {route.name === 'history' && <History />}
        {route.name === 'day' && <DayView date={route.date} />}
        {route.name === 'settings' && <Settings />}
      </main>
      <TabBar route={route} />
    </>
  );
}
