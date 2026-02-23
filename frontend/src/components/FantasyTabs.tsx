import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

interface FantasyTabsProps {
  tabs: {
    value: string;
    label: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
  }[];
  defaultValue?: string;
  orientation?: 'horizontal' | 'vertical';
}

export const FantasyTabs = ({
  tabs,
  defaultValue,
  orientation = 'horizontal',
}: FantasyTabsProps) => {
  const [activeTab, setActiveTab] = useState(defaultValue || tabs[0]?.value);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} orientation={orientation}>
      <TabsList
        className={`
        bg-transparent p-0 h-auto space-x-0
        ${orientation === 'vertical' ? 'flex-col space-y-2 space-x-0' : 'flex-row space-x-2'}
      `}
      >
        {tabs.map((tab, index) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={`
              relative bg-[rgba(15,35,70,0.5)] border border-[rgba(37,99,235,0.2)] rounded-t-lg px-4 py-3
              fantasy-title text-base text-[rgb(148,163,184)] transition-all duration-300 min-w-0
              data-[state=active]:bg-[rgba(37,99,235,0.2)] data-[state=active]:text-[rgb(220,235,255)] data-[state=active]:border-[rgba(212,168,67,0.5)]
              data-[state=active]:shadow-lg data-[state=active]:magical-glow
              hover:bg-[rgba(37,99,235,0.1)] hover:border-[rgba(37,99,235,0.4)] hover:text-[rgb(220,235,255)]
              ${orientation === 'vertical' ? 'rounded-r-lg rounded-t-lg w-full' : ''}
              ${activeTab === tab.value ? 'transform -translate-y-1' : ''}
            `}
          >
            {/* Tab content */}
            <div className="flex items-center space-x-2 relative z-10">
              {tab.icon && (
                <span
                  className={`transition-transform duration-200 ${activeTab === tab.value ? 'scale-110' : ''}`}
                >
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
            </div>

            {/* Active underline glow */}
            {activeTab === tab.value && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-burnished-gold to-transparent" />
            )}

            {/* Decorative divider */}
            {index < tabs.length - 1 && orientation === 'horizontal' && (
              <div className="absolute top-1/2 -right-1 w-px h-5 transform -translate-y-1/2 bg-[rgba(37,99,235,0.2)]" />
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          className={`
            mt-0 glass-panel border border-[rgba(37,99,235,0.2)] rounded-lg p-6
            ${orientation === 'horizontal' ? 'rounded-tl-none' : 'ml-4 rounded-l-none'}
            shadow-lg
          `}
        >
          {/* Inner accent border */}
          <div className="absolute inset-2 border border-burnished-gold/20 rounded-md pointer-events-none" />

          {/* Content */}
          <div className="relative z-10">{tab.content}</div>

          {/* Decorative corner elements */}
          <div className="absolute top-3 right-3 w-4 h-4 border-r border-t border-burnished-gold/30 rounded-tr-md" />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-l border-b border-burnished-gold/30 rounded-bl-md" />
        </TabsContent>
      ))}
    </Tabs>
  );
};

interface FantasyAccordionItem {
  title: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
}

interface FantasyAccordionProps {
  items: FantasyAccordionItem[];
  type?: 'single' | 'multiple';
}

export const FantasyAccordion = ({ items, type = 'single' }: FantasyAccordionProps) => {
  const [openItems, setOpenItems] = useState<string[]>([]);

  const toggleItem = (index: string) => {
    if (type === 'single') {
      setOpenItems(openItems.includes(index) ? [] : [index]);
    } else {
      setOpenItems(
        openItems.includes(index)
          ? openItems.filter((item) => item !== index)
          : [...openItems, index]
      );
    }
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const itemKey = index.toString();
        const isOpen = openItems.includes(itemKey);

        return (
          <Collapsible key={itemKey} open={isOpen} onOpenChange={() => toggleItem(itemKey)}>
            <CollapsibleTrigger className="w-full">
              <div
                className={`
                glass-panel border border-[rgba(37,99,235,0.2)] rounded-lg p-4
                hover:border-[rgba(37,99,235,0.5)] transition-all duration-200
                ${isOpen ? 'rounded-b-none border-b-0 magical-glow' : ''}
                group
              `}
              >
                {/* Hover glow overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-[rgba(37,99,235,0.05)] via-transparent to-[rgba(37,99,235,0.05)] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center space-x-3">
                    {item.icon && (
                      <span className="text-aged-bronze group-hover:text-burnished-gold transition-colors duration-200">
                        {item.icon}
                      </span>
                    )}
                    <h3 className="fantasy-header text-lg text-[rgb(220,235,255)] text-left">
                      {item.title}
                    </h3>
                  </div>

                  <ChevronDown
                    className={`
                    w-5 h-5 text-aged-bronze transition-all duration-300
                    ${isOpen ? 'rotate-180 text-burnished-gold' : 'group-hover:text-burnished-gold'}
                  `}
                  />
                </div>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="glass-panel border border-[rgba(37,99,235,0.2)] border-t-0 rounded-b-lg p-6">
                {/* Inner accent border */}
                <div className="absolute inset-2 border border-burnished-gold/10 rounded-md pointer-events-none" />

                <div className="relative z-10 fantasy-body text-[rgb(220,235,255)]">
                  {item.content}
                </div>

                {/* Decorative bottom flourish */}
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-px bg-gradient-to-r from-transparent via-burnished-gold/30 to-transparent rounded-full" />
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
};
