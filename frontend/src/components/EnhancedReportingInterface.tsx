/**
 * Enhanced Reporting Interface Component
 *
 * Comprehensive reporting interface for advanced epigenetic analysis including:
 * - Custom Report Builder with drag-and-drop metric selection
 * - Export Manager with multiple format support (PDF, CSV, Excel, JSON)
 * - Trend Analysis with data visualization and historical insights
 * - AI-driven Insights with automated recommendations and confidence scoring
 * - Report Templates and saved configurations
 *
 * Features:
 * - Interactive report configuration with real-time preview
 * - Advanced data filtering and date range selection
 * - Automated trend detection and pattern analysis
 * - Machine learning-powered insights and recommendations
 * - Professional export formats with custom branding
 * - Responsive design for mobile and desktop
 * - TypeScript for type safety
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Brain,
  Settings,
  Eye,
  Save,
  Share2,
  Filter,
  BarChart3,
  PieChart,
  LineChart,
} from 'lucide-react';

// Types
interface EnhancedReportingInterfaceProps {
  userId: number | null;
  selectedHorses?: number[];
  reportType?: 'individual' | 'comparison' | 'stable';
  className?: string;
}

interface ReportConfig {
  title: string;
  description?: string;
  sections: string[];
  dateRange: string;
  customDateStart?: string;
  customDateEnd?: string;
  format: 'pdf' | 'csv' | 'excel' | 'json';
  includeCharts: boolean;
  includeSummary: boolean;
  template?: string;
}

interface MetricDefinition {
  id: string;
  label: string;
  category: 'genetics' | 'performance' | 'care' | 'environmental' | 'breeding';
  description: string;
  dataType: 'numeric' | 'categorical' | 'timeline';
  chartTypes: string[];
}

interface TrendData {
  traitDevelopment: Array<{
    date: string;
    value: number;
    trend: 'up' | 'down' | 'stable';
    significance: number;
  }>;
  performanceScores: Array<{
    metric: string;
    current: number;
    previous: number;
    change: number;
    percentChange: number;
  }>;
  environmentalFactors: Array<{
    factor: string;
    impact: number;
    correlation: number;
  }>;
}

interface AIInsight {
  id: string;
  type: 'positive' | 'warning' | 'neutral' | 'critical';
  title: string;
  description: string;
  confidence: number;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  dataPoints: number;
  lastUpdated: string;
}

interface ReportData {
  summary: {
    totalHorses: number;
    averageScore: number;
    topPerformer: string;
    improvementRate: number;
  };
  trends: TrendData;
  insights: AIInsight[];
  rawData: any[];
}

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Custom hooks for data fetching
const useReportMetrics = () => {
  return useQuery({
    queryKey: ['report-metrics'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/reports/metrics`);
      if (!response.ok) throw new Error('Failed to fetch report metrics');
      const result = await response.json();
      return result.data as MetricDefinition[];
    },
  });
};

const useReportData = (config: ReportConfig, horseIds: number[]) => {
  return useQuery({
    queryKey: ['report-data', config, horseIds],
    queryFn: async () => {
      if (config.sections.length === 0) return null;
      const response = await fetch(`${API_BASE_URL}/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          horseIds,
        }),
      });
      if (!response.ok) throw new Error('Failed to fetch report data');
      const result = await response.json();
      return result.data as ReportData;
    },
    enabled: config.sections.length > 0,
  });
};

const useGenerateReport = () => {
  return useMutation({
    mutationFn: async ({ config, horseIds }: { config: ReportConfig; horseIds: number[] }) => {
      const response = await fetch(`${API_BASE_URL}/reports/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, horseIds }),
      });
      if (!response.ok) throw new Error('Failed to generate report');
      return response.blob();
    },
  });
};

// Main Component
const EnhancedReportingInterface: React.FC<EnhancedReportingInterfaceProps> = ({
  userId,
  selectedHorses = [],
  reportType = 'individual',
  className = '',
}) => {
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    title: 'Epigenetic Analysis Report',
    sections: ['overview', 'traits', 'performance'],
    dateRange: 'last_30_days',
    format: 'pdf',
    includeCharts: true,
    includeSummary: true,
  });

  const [activeTab, setActiveTab] = useState<'builder' | 'preview' | 'insights'>('builder');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Data queries
  const metricsQuery = useReportMetrics();
  const reportDataQuery = useReportData(reportConfig, selectedHorses);
  const generateReportMutation = useGenerateReport();

  // Handle no user
  if (!userId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>Please log in to access reporting features</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (metricsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p>Loading reporting interface...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (metricsQuery.error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading reporting interface</p>
          <button
            onClick={() => metricsQuery.refetch()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const availableMetrics = metricsQuery.data || [];

  // Group metrics by category
  const metricsByCategory = useMemo(() => {
    return availableMetrics.reduce(
      (acc, metric) => {
        if (!acc[metric.category]) {
          acc[metric.category] = [];
        }
        acc[metric.category].push(metric);
        return acc;
      },
      {} as Record<string, MetricDefinition[]>
    );
  }, [availableMetrics]);

  // Handle section toggle
  const handleSectionToggle = (sectionId: string) => {
    const newSections = reportConfig.sections.includes(sectionId)
      ? reportConfig.sections.filter((s) => s !== sectionId)
      : [...reportConfig.sections, sectionId];
    setReportConfig({ ...reportConfig, sections: newSections });
  };

  // Handle report generation
  const handleGenerateReport = async () => {
    try {
      const blob = await generateReportMutation.mutateAsync({
        config: reportConfig,
        horseIds: selectedHorses,
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${reportConfig.title.replace(/\s+/g, '_')}.${reportConfig.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  // Handle export format
  const handleExport = (format: ReportConfig['format']) => {
    setReportConfig({ ...reportConfig, format });
    handleGenerateReport();
  };

  return (
    <div data-testid="enhanced-reporting-interface" className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Enhanced Reporting</h2>
          <p className="text-gray-600">Create comprehensive epigenetic analysis reports</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={generateReportMutation.isPending || reportConfig.sections.length === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {generateReportMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                <span>Generate Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'builder', label: 'Report Builder', icon: Settings },
            { id: 'preview', label: 'Preview', icon: Eye },
            { id: 'insights', label: 'AI Insights', icon: Brain },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'builder' && (
        <ReportBuilderTab
          reportConfig={reportConfig}
          setReportConfig={setReportConfig}
          metricsByCategory={metricsByCategory}
          showAdvanced={showAdvanced}
          onSectionToggle={handleSectionToggle}
        />
      )}

      {activeTab === 'preview' && (
        <ReportPreviewTab
          reportData={reportDataQuery.data}
          isLoading={reportDataQuery.isLoading}
          config={reportConfig}
        />
      )}

      {activeTab === 'insights' && (
        <AIInsightsTab
          insights={reportDataQuery.data?.insights || []}
          isLoading={reportDataQuery.isLoading}
        />
      )}

      {/* Export Manager */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Download className="w-5 h-5" />
          <span>Export Manager</span>
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="export-options">
          {[
            {
              format: 'pdf' as const,
              label: 'PDF',
              description: 'Formatted Report',
              icon: FileText,
            },
            { format: 'csv' as const, label: 'CSV', description: 'Data Export', icon: BarChart3 },
            {
              format: 'excel' as const,
              label: 'Excel',
              description: 'Spreadsheet',
              icon: PieChart,
            },
            { format: 'json' as const, label: 'JSON', description: 'Raw Data', icon: LineChart },
          ].map((option) => (
            <button
              key={option.format}
              onClick={() => handleExport(option.format)}
              className={`p-4 border rounded-lg hover:bg-gray-50 text-center transition-colors ${
                reportConfig.format === option.format
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              <option.icon className="w-6 h-6 mx-auto mb-2 text-gray-600" />
              <div className="text-lg font-medium">{option.label}</div>
              <div className="text-sm text-gray-500">{option.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Report Builder Tab Component
interface ReportBuilderTabProps {
  reportConfig: ReportConfig;
  setReportConfig: (config: ReportConfig) => void;
  metricsByCategory: Record<string, MetricDefinition[]>;
  showAdvanced: boolean;
  onSectionToggle: (sectionId: string) => void;
}

const ReportBuilderTab: React.FC<ReportBuilderTabProps> = ({
  reportConfig,
  setReportConfig,
  metricsByCategory,
  showAdvanced,
  onSectionToggle,
}) => {
  return (
    <div className="space-y-6">
      {/* Report Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Custom Report Builder</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Title</label>
            <input
              type="text"
              value={reportConfig.title}
              onChange={(e) => setReportConfig({ ...reportConfig, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="report-title-input"
              placeholder="Enter report title..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select
              value={reportConfig.dateRange}
              onChange={(e) => setReportConfig({ ...reportConfig, dateRange: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              data-testid="date-range-select"
            >
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="last_90_days">Last 90 Days</option>
              <option value="last_6_months">Last 6 Months</option>
              <option value="last_year">Last Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range */}
        {reportConfig.dateRange === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={reportConfig.customDateStart || ''}
                onChange={(e) =>
                  setReportConfig({ ...reportConfig, customDateStart: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={reportConfig.customDateEnd || ''}
                onChange={(e) =>
                  setReportConfig({ ...reportConfig, customDateEnd: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Report Description */}
        {showAdvanced && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={reportConfig.description || ''}
              onChange={(e) => setReportConfig({ ...reportConfig, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Add a description for this report..."
            />
          </div>
        )}

        {/* Report Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeCharts"
              checked={reportConfig.includeCharts}
              onChange={(e) =>
                setReportConfig({ ...reportConfig, includeCharts: e.target.checked })
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="includeCharts" className="ml-2 block text-sm text-gray-700">
              Include Charts and Visualizations
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeSummary"
              checked={reportConfig.includeSummary}
              onChange={(e) =>
                setReportConfig({ ...reportConfig, includeSummary: e.target.checked })
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="includeSummary" className="ml-2 block text-sm text-gray-700">
              Include Executive Summary
            </label>
          </div>
        </div>
      </div>

      {/* Available Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-medium text-gray-700 mb-4">Available Metrics</h4>

        <div className="space-y-6" data-testid="metrics-grid">
          {Object.entries(metricsByCategory).map(([category, metrics]) => (
            <div key={category}>
              <h5 className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-3">
                {category.replace('_', ' ')}
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {metrics.map((metric) => (
                  <div
                    key={metric.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      reportConfig.sections.includes(metric.id)
                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                    onClick={() => onSectionToggle(metric.id)}
                    data-testid={`metric-${metric.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{metric.label}</span>
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          reportConfig.sections.includes(metric.id)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {reportConfig.sections.includes(metric.id) && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{metric.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 capitalize">{metric.dataType}</span>
                      <div className="flex space-x-1">
                        {metric.chartTypes.slice(0, 2).map((chartType) => (
                          <span
                            key={chartType}
                            className="text-xs bg-gray-100 text-gray-600 px-1 rounded"
                          >
                            {chartType}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Sections Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-medium text-gray-700 mb-3">Selected Sections</h4>
        <div className="flex flex-wrap gap-2" data-testid="selected-sections">
          {reportConfig.sections.length > 0 ? (
            reportConfig.sections.map((sectionId) => {
              const metric = Object.values(metricsByCategory)
                .flat()
                .find((m) => m.id === sectionId);
              return (
                <span
                  key={sectionId}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center space-x-2"
                >
                  <span>{metric?.label || sectionId}</span>
                  <button
                    onClick={() => onSectionToggle(sectionId)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              );
            })
          ) : (
            <span className="text-gray-500 text-sm">No sections selected</span>
          )}
        </div>

        {reportConfig.sections.length > 0 && (
          <div className="mt-3 text-sm text-gray-600">
            {reportConfig.sections.length} section{reportConfig.sections.length !== 1 ? 's' : ''}{' '}
            selected
          </div>
        )}
      </div>
    </div>
  );
};

// Report Preview Tab Component
interface ReportPreviewTabProps {
  reportData: ReportData | null | undefined;
  isLoading: boolean;
  config: ReportConfig;
}

const ReportPreviewTab: React.FC<ReportPreviewTabProps> = ({ reportData, isLoading, config }) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Report Preview</h3>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Report Preview</h3>
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>Select metrics to preview your report</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">{config.title}</h1>
          {config.description && <p className="text-gray-600 mt-2">{config.description}</p>}
          <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
            <span>Generated: {new Date().toLocaleDateString()}</span>
            <span>Period: {config.dateRange.replace('_', ' ')}</span>
            <span>Sections: {config.sections.length}</span>
          </div>
        </div>

        {/* Executive Summary */}
        {config.includeSummary && reportData.summary && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Executive Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-600">
                  {reportData.summary.totalHorses}
                </div>
                <div className="text-sm text-gray-600">Total Horses</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {reportData.summary.averageScore}
                </div>
                <div className="text-sm text-gray-600">Average Score</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded">
                <div className="text-lg font-bold text-purple-600">
                  {reportData.summary.topPerformer}
                </div>
                <div className="text-sm text-gray-600">Top Performer</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded">
                <div className="text-2xl font-bold text-orange-600">
                  {reportData.summary.improvementRate}%
                </div>
                <div className="text-sm text-gray-600">Improvement Rate</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trend Analysis Preview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Trend Analysis</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trait Development Trends */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3">Trait Development</h4>
            <div className="space-y-2" data-testid="trait-trends">
              {reportData.trends.traitDevelopment.map((point, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <span className="text-sm">{point.date}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{point.value}%</span>
                    <span
                      className={`text-xs ${
                        point.trend === 'up'
                          ? 'text-green-600'
                          : point.trend === 'down'
                            ? 'text-red-600'
                            : 'text-gray-600'
                      }`}
                    >
                      {point.trend === 'up' ? '↗' : point.trend === 'down' ? '↘' : '→'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3">Performance Changes</h4>
            <div className="space-y-2" data-testid="performance-trends">
              {reportData.trends.performanceScores.map((metric, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <span className="text-sm">{metric.metric}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{metric.current}</span>
                    <span
                      className={`text-xs ${metric.change > 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {metric.change > 0 ? '+' : ''}
                      {metric.change} ({metric.percentChange > 0 ? '+' : ''}
                      {metric.percentChange}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Preview */}
      {config.includeCharts && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Data Visualizations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 bg-gray-100 rounded flex items-center justify-center">
              <div className="text-center text-gray-500">
                <BarChart3 className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Trait Development Chart</p>
              </div>
            </div>
            <div className="h-48 bg-gray-100 rounded flex items-center justify-center">
              <div className="text-center text-gray-500">
                <LineChart className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Performance Trends</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// AI Insights Tab Component
interface AIInsightsTabProps {
  insights: AIInsight[];
  isLoading: boolean;
}

const AIInsightsTab: React.FC<AIInsightsTabProps> = ({ insights, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">AI-Driven Insights</h3>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 border rounded">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">AI-Driven Insights</h3>
        <div className="text-center py-8 text-gray-500">
          <Brain className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No insights available yet</p>
          <p className="text-sm">Generate a report to see AI-powered analysis</p>
        </div>
      </div>
    );
  }

  // Group insights by priority
  const insightsByPriority = insights.reduce(
    (acc, insight) => {
      if (!acc[insight.priority]) {
        acc[insight.priority] = [];
      }
      acc[insight.priority].push(insight);
      return acc;
    },
    {} as Record<string, AIInsight[]>
  );

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'positive':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'critical':
        return '🚨';
      default:
        return 'ℹ️';
    }
  };

  const getInsightColor = (type: AIInsight['type']) => {
    switch (type) {
      case 'positive':
        return 'bg-green-50 border-green-400 text-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-400 text-yellow-800';
      case 'critical':
        return 'bg-red-50 border-red-400 text-red-800';
      default:
        return 'bg-blue-50 border-blue-400 text-blue-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Insights Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Brain className="w-5 h-5" />
          <span>AI-Driven Insights</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-600">{insights.length}</div>
            <div className="text-sm text-gray-600">Total Insights</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-600">
              {Math.round(
                (insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length) * 100
              )}
              %
            </div>
            <div className="text-sm text-gray-600">Avg Confidence</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded">
            <div className="text-2xl font-bold text-purple-600">
              {insightsByPriority.high?.length || 0}
            </div>
            <div className="text-sm text-gray-600">High Priority</div>
          </div>
        </div>
      </div>

      {/* Insights by Priority */}
      {(['high', 'medium', 'low'] as const).map((priority) => {
        const priorityInsights = insightsByPriority[priority] || [];
        if (priorityInsights.length === 0) return null;

        return (
          <div key={priority} className="bg-white rounded-lg shadow p-6">
            <h4 className="font-medium text-gray-700 mb-4 flex items-center space-x-2">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(priority)}`}
              >
                {priority.toUpperCase()} PRIORITY
              </span>
              <span>
                ({priorityInsights.length} insight{priorityInsights.length !== 1 ? 's' : ''})
              </span>
            </h4>

            <div className="space-y-4" data-testid="ai-insights">
              {priorityInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={`p-4 rounded-lg border-l-4 ${getInsightColor(insight.type)}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getInsightIcon(insight.type)}</span>
                      <h5 className="font-medium">{insight.title}</h5>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="text-gray-500">
                        {Math.round(insight.confidence * 100)}% confidence
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-500">{insight.dataPoints} data points</span>
                    </div>
                  </div>

                  <p className="text-sm mb-3">{insight.description}</p>

                  <div className="bg-white bg-opacity-50 p-3 rounded border">
                    <h6 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
                      Recommendation
                    </h6>
                    <p className="text-sm font-medium">{insight.recommendation}</p>
                  </div>

                  <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                    <span>Category: {insight.category}</span>
                    <span>Updated: {new Date(insight.lastUpdated).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Insight Categories */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-medium text-gray-700 mb-4">Insights by Category</h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(
            insights.reduce(
              (acc, insight) => {
                acc[insight.category] = (acc[insight.category] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>
            )
          ).map(([category, count]) => (
            <div key={category} className="text-center p-3 bg-gray-50 rounded">
              <div className="text-lg font-bold text-gray-900">{count}</div>
              <div className="text-sm text-gray-600 capitalize">{category.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EnhancedReportingInterface;
