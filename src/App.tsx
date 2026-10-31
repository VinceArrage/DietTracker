import { ErrorBoundary } from './components/ErrorBoundary';
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
        <ErrorBoundary key={route.name}>
          {route.name === 'today' && <Today />}
          {route.name === 'plan' && <PlanScreen />}
          {route.name === 'history' && <History />}
          {route.name === 'day' && <DayView date={route.date} />}
          {route.name === 'settings' && <Settings />}
        </ErrorBoundary>
      </main>
      <TabBar route={route} />
    </>
  );
}
