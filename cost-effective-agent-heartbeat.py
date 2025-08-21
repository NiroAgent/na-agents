#!/usr/bin/env python3
"""
Cost-Effective Agent Heartbeat Script
Runs on EC2/ECS instances to report metrics instead of expensive CloudWatch polling
Cost: $0/month vs $200/month for CloudWatch API approach

Install: pip install psutil requests
Usage: python3 agent_heartbeat.py
"""

import psutil
import requests
import time
import json
import os
import socket
from datetime import datetime

class CostEffectiveAgent:
    def __init__(self):
        self.agent_id = os.environ.get('AGENT_ID', f'agent-{socket.gethostname()}')
        self.agent_type = os.environ.get('AGENT_TYPE', 'developer')
        self.dashboard_url = os.environ.get('DASHBOARD_URL', 'http://localhost:4001')
        self.heartbeat_interval = int(os.environ.get('HEARTBEAT_INTERVAL', '30'))  # seconds
        self.tasks_completed = 0
        self.current_tasks = 0
        
        print(f"🚀 Starting cost-effective agent: {self.agent_id}")
        print(f"📊 Dashboard URL: {self.dashboard_url}")
        print(f"⏱️  Heartbeat interval: {self.heartbeat_interval}s")

    def get_system_metrics(self):
        """Get real system metrics without expensive CloudWatch API calls"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            
            # Network I/O
            network = psutil.net_io_counters()
            
            return {
                'cpuUsage': round(cpu_percent, 2),
                'memoryUsage': round(memory_percent, 2),
                'diskUsage': round(disk_percent, 2),
                'networkIn': network.bytes_recv,
                'networkOut': network.bytes_sent,
                'tasksCompleted': self.tasks_completed,
                'currentTasks': self.current_tasks
            }
        except Exception as e:
            print(f"❌ Error getting metrics: {e}")
            return {
                'cpuUsage': 0,
                'memoryUsage': 0,
                'diskUsage': 0,
                'networkIn': 0,
                'networkOut': 0,
                'tasksCompleted': self.tasks_completed,
                'currentTasks': self.current_tasks
            }

    def get_instance_metadata(self):
        """Get EC2 instance metadata (free)"""
        try:
            # Try to get EC2 instance metadata
            metadata_url = 'http://169.254.169.254/latest/meta-data'
            response = requests.get(f'{metadata_url}/instance-id', timeout=2)
            instance_id = response.text if response.status_code == 200 else None
            
            instance_type = None
            try:
                response = requests.get(f'{metadata_url}/instance-type', timeout=2)
                instance_type = response.text if response.status_code == 200 else None
            except:
                pass
                
            return {
                'instanceId': instance_id,
                'instanceType': instance_type,
                'hostname': socket.gethostname(),
                'agentType': self.agent_type,
                'version': '1.0.0',
                'capabilities': ['task_execution', 'code_generation', 'monitoring']
            }
        except:
            return {
                'hostname': socket.gethostname(),
                'agentType': self.agent_type,
                'version': '1.0.0',
                'capabilities': ['task_execution', 'code_generation', 'monitoring']
            }

    def calculate_cost(self, instance_type=None):
        """Estimate cost based on instance type (no AWS Cost Explorer API needed)"""
        # Simple cost estimation without API calls
        cost_map = {
            't2.micro': 0.0116,
            't2.small': 0.023,
            't2.medium': 0.046,
            't3.micro': 0.0104,
            't3.small': 0.0208,
            't3.medium': 0.0416,
            'm5.large': 0.096,
            'm5.xlarge': 0.192,
            'c5.large': 0.085,
            'c5.xlarge': 0.17
        }
        
        hourly = cost_map.get(instance_type, 0.05)  # Default to $0.05/hour
        
        return {
            'hourly': round(hourly, 4),
            'daily': round(hourly * 24, 2),
            'monthly': round(hourly * 24 * 30, 2)
        }

    def send_heartbeat(self):
        """Send heartbeat to dashboard (replaces expensive CloudWatch polling)"""
        try:
            metrics = self.get_system_metrics()
            metadata = self.get_instance_metadata()
            cost = self.calculate_cost(metadata.get('instanceType'))
            
            # Determine status based on current load
            cpu = metrics['cpuUsage']
            if cpu > 80:
                status = 'busy'
            elif cpu > 10:
                status = 'running'
            else:
                status = 'idle'
            
            payload = {
                'status': status,
                'metrics': metrics,
                'cost': cost,
                'metadata': metadata,
                'timestamp': datetime.now().isoformat()
            }
            
            url = f'{self.dashboard_url}/api/agents/{self.agent_id}/heartbeat'
            response = requests.post(url, json=payload, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Heartbeat sent successfully - CPU: {cpu}%, Status: {status}")
                return True
            else:
                print(f"❌ Heartbeat failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error sending heartbeat: {e}")
            return False

    def simulate_task_activity(self):
        """Simulate task completion for demo purposes"""
        import random
        if random.random() < 0.1:  # 10% chance to complete a task
            self.tasks_completed += 1
            print(f"📋 Task completed! Total: {self.tasks_completed}")
        
        if random.random() < 0.05:  # 5% chance to start a new task
            self.current_tasks = min(self.current_tasks + 1, 5)
            print(f"🔄 New task started! Current: {self.current_tasks}")
        
        if random.random() < 0.08 and self.current_tasks > 0:  # 8% chance to finish current task
            self.current_tasks -= 1
            print(f"✅ Current task finished! Remaining: {self.current_tasks}")

    def run(self):
        """Main agent loop - much cheaper than CloudWatch polling"""
        print(f"🎯 Agent {self.agent_id} starting cost-effective monitoring...")
        
        while True:
            try:
                # Send heartbeat with current metrics
                success = self.send_heartbeat()
                
                # Simulate some task activity
                self.simulate_task_activity()
                
                if not success:
                    print("⚠️  Failed to send heartbeat, will retry in next cycle")
                
                # Wait for next heartbeat
                time.sleep(self.heartbeat_interval)
                
            except KeyboardInterrupt:
                print(f"\n🛑 Agent {self.agent_id} stopping...")
                break
            except Exception as e:
                print(f"❌ Unexpected error: {e}")
                time.sleep(self.heartbeat_interval)

if __name__ == '__main__':
    # Example usage:
    # export AGENT_ID="ai-developer-agent-1"
    # export AGENT_TYPE="developer" 
    # export DASHBOARD_URL="http://your-dashboard:4001"
    # python3 agent_heartbeat.py
    
    agent = CostEffectiveAgent()
    agent.run()
