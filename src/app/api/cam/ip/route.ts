import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    const candidates: string[] = [];
    let fallbackIp = 'localhost';
    
    for (const name of Object.keys(interfaces)) {
      const lowerName = name.toLowerCase();
      // Skip virtual adapters to avoid returning unusable internal/VM IPs
      if (
        lowerName.includes('virtual') || 
        lowerName.includes('vbox') || 
        lowerName.includes('vmware') || 
        lowerName.includes('docker') || 
        lowerName.includes('wsl') ||
        lowerName.includes('vpn')
      ) {
        continue;
      }
      
      for (const iface of interfaces[name] || []) {
        if (!iface.internal && iface.family === 'IPv4') {
          // Prioritize Wi-Fi and Ethernet
          if (
            lowerName.includes('wi-fi') || 
            lowerName.includes('wifi') || 
            lowerName.includes('wlan') || 
            lowerName.includes('ethernet')
          ) {
            candidates.unshift(iface.address);
          } else {
            candidates.push(iface.address);
          }
        }
      }
    }
    
    // Fallback to all adapters if no prioritized ones found
    if (candidates.length === 0) {
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
          if (!iface.internal && iface.family === 'IPv4') {
            candidates.push(iface.address);
          }
        }
      }
    }
    
    const ip = candidates[0] || fallbackIp;
    return NextResponse.json({ ip });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
