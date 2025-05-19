import { Route, Switch } from 'wouter';
import { getCurrentUser } from '../shared/auth';

const PrivateRoute = ({ children, role }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error getting current user:', error);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, []);

  if (loading) return <div>Loading...</div>;

  if (!user || (role && user.role !== role)) {
    return <div>Unauthorized</div>;
  }

  return children;
};

const Routes = () => {
  return (
    <Switch>
      <Route path="/client">
        <PrivateRoute role="client">
          <div>Client Dashboard</div>
        </PrivateRoute>
      </Route>
      <Route path="/reader">
        <PrivateRoute role="reader">
          <div>Reader Dashboard</div>
        </PrivateRoute>
      </Route>
      <Route path="/">
        <div>Public Home</div>
      </Route>
    </Switch>
  );
};

export default Routes;
