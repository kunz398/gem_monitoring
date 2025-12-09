import PocketBase from 'pocketbase';

const PB_URL = "https://cloud-monitoring.corp.spc.int/";
const pb = new PocketBase(PB_URL);

export const systemMonitorApi = {
  fetchSystems: async () => {
    try {
      // Authenticate
      await pb.collection("users").authWithPassword("divesha@spc.int", "Un2345678");
      
      // List and filter system records
      const result = await pb.collection("systems").getList(1, 50, {
        filter: 'status = "up"',
        sort: '-created',
      });
      
      return result.items.map(item => ({
        id: item.id,
        name: item.name,
        type: 'servers', // Default group
        protocol: 'system-monitor',
        last_status: item.status,
        ip_address: item.host,
        port: item.port || '',
        updated_at: item.updated,
        is_external_system: true,
        system_info: item.info,
        success_count: 0,
        failure_count: 0,
        check_interval_sec: 0
      }));
    } catch (err) {
      console.error("Error fetching system monitor data:", err);
      return [];
    }
  }
};
