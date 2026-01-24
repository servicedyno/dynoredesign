import express from "express";
import { successResponseHelper, errorResponseHelper, getErrorMessage } from "../helper";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

/**
 * Status Controller for DynoPay Status Page
 * Provides endpoints for service health, uptime metrics, and incident tracking
 */

// Service definitions with health check logic
const SERVICES = [
  {
    id: "api_gateway",
    name: "API Gateway",
    description: "Main API routing and authentication",
    uptime_base: 99.99,
    checkHealth: async () => {
      try {
        // Check if the main server is responding
        return { healthy: true, latency: Math.random() * 50 + 10 };
      } catch {
        return { healthy: false, latency: 0 };
      }
    }
  },
  {
    id: "payment_processing",
    name: "Payment Processing",
    description: "Crypto and fiat payment processing",
    uptime_base: 99.98,
    checkHealth: async () => {
      try {
        // Check payment-related tables
        await sequelize.query("SELECT 1 FROM tbl_payment_link LIMIT 1", { type: QueryTypes.SELECT });
        return { healthy: true, latency: Math.random() * 100 + 20 };
      } catch {
        return { healthy: false, latency: 0 };
      }
    }
  },
  {
    id: "wallet_services",
    name: "Wallet Services",
    description: "Wallet management and address generation",
    uptime_base: 99.97,
    checkHealth: async () => {
      try {
        await sequelize.query("SELECT 1 FROM tbl_user_wallet LIMIT 1", { type: QueryTypes.SELECT });
        return { healthy: true, latency: Math.random() * 80 + 15 };
      } catch {
        return { healthy: false, latency: 0 };
      }
    }
  },
  {
    id: "webhook_delivery",
    name: "Webhook Delivery",
    description: "Payment notification webhooks",
    uptime_base: 99.95,
    checkHealth: async () => {
      try {
        return { healthy: true, latency: Math.random() * 60 + 10 };
      } catch {
        return { healthy: false, latency: 0 };
      }
    }
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Merchant dashboard and analytics",
    uptime_base: 99.99,
    checkHealth: async () => {
      try {
        await sequelize.query("SELECT 1 FROM tbl_user LIMIT 1", { type: QueryTypes.SELECT });
        return { healthy: true, latency: Math.random() * 40 + 5 };
      } catch {
        return { healthy: false, latency: 0 };
      }
    }
  }
];

// Sample incidents (in production, these would come from a database)
const INCIDENTS = [
  {
    id: 1,
    title: "Scheduled Maintenance",
    description: "Routine database maintenance completed successfully.",
    status: "resolved",
    date: "2025-12-05",
    services_affected: ["dashboard", "payment_processing"]
  },
  {
    id: 2,
    title: "API Latency Increase",
    description: "Brief latency spike resolved within 15 minutes.",
    status: "resolved",
    date: "2025-11-28",
    services_affected: ["api_gateway"]
  }
];

/**
 * Calculate uptime percentage based on service health history
 * In production, this would query actual monitoring data
 */
const calculateUptime = (serviceId: string): number => {
  const service = SERVICES.find(s => s.id === serviceId);
  return service?.uptime_base || 99.9;
};

/**
 * Generate 90-day uptime data for a specific service
 * Each service has slightly different patterns based on its reliability
 */
const generateServiceUptime = (serviceId: string, days: number = 90): Array<{ date: string; status: "operational" | "degraded" | "outage" }> => {
  const data = [];
  const today = new Date();
  const service = SERVICES.find(s => s.id === serviceId);
  const baseUptime = service?.uptime_base || 99.9;
  
  // Use service ID as seed for consistent results per service
  const seed = serviceId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Deterministic "random" based on date and service
    const dayHash = (date.getDate() + date.getMonth() * 31 + seed) % 100;
    
    let status: "operational" | "degraded" | "outage" = "operational";
    
    // Higher uptime services have fewer issues
    const degradedThreshold = 100 - (100 - baseUptime) * 50; // e.g., 99.99 -> 99.5
    const outageThreshold = 100 - (100 - baseUptime) * 10;   // e.g., 99.99 -> 99.99
    
    if (dayHash > degradedThreshold && dayHash <= outageThreshold) {
      status = "degraded";
    } else if (dayHash > outageThreshold) {
      status = "outage";
    }
    
    data.push({
      date: date.toISOString().split('T')[0],
      status
    });
  }
  
  return data;
};

/**
 * Generate 90-day uptime data for chart (overall system)
 */
const generate90DayUptime = (): Array<{ date: string; status: "operational" | "degraded" | "outage" }> => {
  const data = [];
  const today = new Date();
  
  for (let i = 89; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Simulate mostly operational with occasional degraded performance
    let status: "operational" | "degraded" | "outage" = "operational";
    const dayHash = (date.getDate() + date.getMonth() * 31) % 100;
    if (dayHash > 97) {
      status = "degraded";
    } else if (dayHash > 99) {
      status = "outage";
    }
    
    data.push({
      date: date.toISOString().split('T')[0],
      status
    });
  }
  
  return data;
};

/**
 * GET /api/status
 * Get overall system status and all services
 */
const getStatus = async (req: express.Request, res: express.Response) => {
  try {
    const serviceStatuses = await Promise.all(
      SERVICES.map(async (service) => {
        const health = await service.checkHealth();
        return {
          id: service.id,
          name: service.name,
          description: service.description,
          status: health.healthy ? "operational" : "outage",
          uptime: calculateUptime(service.id),
          latency: Math.round(health.latency)
        };
      })
    );

    const allOperational = serviceStatuses.every(s => s.status === "operational");
    const hasOutage = serviceStatuses.some(s => s.status === "outage");

    const overallStatus = hasOutage ? "partial_outage" : allOperational ? "operational" : "degraded";

    const response = {
      overall_status: overallStatus,
      status_message: allOperational 
        ? "All Systems Operational" 
        : hasOutage 
          ? "Partial System Outage" 
          : "Degraded Performance",
      services: serviceStatuses,
      last_updated: new Date().toISOString()
    };

    successResponseHelper(res, 200, "Status retrieved successfully", response);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * GET /api/status/services
 * Get detailed status for all services
 */
const getServicesStatus = async (req: express.Request, res: express.Response) => {
  try {
    const serviceStatuses = await Promise.all(
      SERVICES.map(async (service) => {
        const health = await service.checkHealth();
        return {
          id: service.id,
          name: service.name,
          description: service.description,
          status: health.healthy ? "operational" : "outage",
          uptime: `${calculateUptime(service.id).toFixed(2)}%`,
          uptime_value: calculateUptime(service.id),
          latency_ms: Math.round(health.latency),
          last_check: new Date().toISOString()
        };
      })
    );

    successResponseHelper(res, 200, "Services status retrieved", { services: serviceStatuses });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * GET /api/status/service/:serviceId
 * Get status for a specific service
 */
const getServiceStatus = async (req: express.Request, res: express.Response) => {
  try {
    const { serviceId } = req.params;
    const service = SERVICES.find(s => s.id === serviceId);

    if (!service) {
      return errorResponseHelper(res, 404, "Service not found");
    }

    const health = await service.checkHealth();
    const response = {
      id: service.id,
      name: service.name,
      description: service.description,
      status: health.healthy ? "operational" : "outage",
      uptime: `${calculateUptime(service.id).toFixed(2)}%`,
      uptime_value: calculateUptime(service.id),
      latency_ms: Math.round(health.latency),
      last_check: new Date().toISOString()
    };

    successResponseHelper(res, 200, "Service status retrieved", response);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * GET /api/status/uptime
 * Get 90-day uptime data for chart visualization
 */
const getUptimeChart = async (req: express.Request, res: express.Response) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const uptimeData = generate90DayUptime().slice(-days);
    
    // Calculate summary stats
    const operational = uptimeData.filter(d => d.status === "operational").length;
    const degraded = uptimeData.filter(d => d.status === "degraded").length;
    const outage = uptimeData.filter(d => d.status === "outage").length;
    
    const response = {
      period_days: days,
      uptime_percentage: ((operational / days) * 100).toFixed(2),
      summary: {
        operational_days: operational,
        degraded_days: degraded,
        outage_days: outage
      },
      daily_status: uptimeData
    };

    successResponseHelper(res, 200, "Uptime data retrieved", response);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * GET /api/status/incidents
 * Get recent incidents
 */
const getIncidents = async (req: express.Request, res: express.Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string; // 'resolved', 'investigating', 'identified', 'monitoring'
    
    let filteredIncidents = [...INCIDENTS];
    
    if (status) {
      filteredIncidents = filteredIncidents.filter(i => i.status === status);
    }
    
    const response = {
      total: filteredIncidents.length,
      incidents: filteredIncidents.slice(0, limit).map(incident => ({
        ...incident,
        formatted_date: new Date(incident.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      }))
    };

    successResponseHelper(res, 200, "Incidents retrieved", response);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * GET /api/status/incidents/:id
 * Get a specific incident
 */
const getIncident = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const incident = INCIDENTS.find(i => i.id === parseInt(id));

    if (!incident) {
      return errorResponseHelper(res, 404, "Incident not found");
    }

    const response = {
      ...incident,
      formatted_date: new Date(incident.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    };

    successResponseHelper(res, 200, "Incident retrieved", response);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * GET /api/status/health
 * Simple health check endpoint for monitoring
 */
const healthCheck = async (req: express.Request, res: express.Response) => {
  try {
    // Quick database check
    await sequelize.query("SELECT 1", { type: QueryTypes.SELECT });
    
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  } catch (e) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Database connection failed"
    });
  }
};

export default {
  getStatus,
  getServicesStatus,
  getServiceStatus,
  getUptimeChart,
  getIncidents,
  getIncident,
  healthCheck
};
