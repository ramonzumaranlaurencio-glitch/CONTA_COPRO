import * as Premium from './DashboardEnterprisePremium';

const DashboardEnterprise =
  (Premium as any).default ?? (Premium as any).DashboardEnterprisePremium;

export { DashboardEnterprise };
export default DashboardEnterprise;
