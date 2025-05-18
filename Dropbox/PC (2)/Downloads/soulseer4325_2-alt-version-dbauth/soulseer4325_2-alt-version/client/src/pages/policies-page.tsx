import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, Lock, FileText, Cookie, RotateCcw, AlertTriangle } from 'lucide-react';

export default function PoliciesPage() {
  const [activeTab, setActiveTab] = useState('privacy');

  const policyLinks = [
    {
      id: 'privacy',
      title: 'Privacy Policy',
      icon: <Lock className="h-5 w-5 mr-2" />,
      link: 'https://app.termly.io/policy-viewer/policy.html?policyUUID=a14c6d2c-e819-4fd7-bc40-e2ea345b5dbe'
    },
    {
      id: 'terms',
      title: 'Terms and Conditions',
      icon: <FileText className="h-5 w-5 mr-2" />,
      link: 'https://app.termly.io/policy-viewer/policy.html?policyUUID=956ff7f3-c073-4866-8bff-797bec6f7b18'
    },
    {
      id: 'eula',
      title: 'End User License Agreement',
      icon: <FileText className="h-5 w-5 mr-2" />,
      link: 'https://app.termly.io/policy-viewer/policy.html?policyUUID=725d0a47-aaea-442b-8e64-3d7737de6fe2'
    },
    {
      id: 'cookies',
      title: 'Cookie Policy',
      icon: <Cookie className="h-5 w-5 mr-2" />,
      link: 'https://app.termly.io/policy-viewer/policy.html?policyUUID=f00b7ccd-6e58-4388-84ad-6e6fe777884d'
    },
    {
      id: 'returns',
      title: 'Return Policy',
      icon: <RotateCcw className="h-5 w-5 mr-2" />,
      link: 'https://app.termly.io/policy-viewer/policy.html?policyUUID=cf768ca5-5ba9-4436-9bac-00d52b1e1a07'
    },
    {
      id: 'disclaimer',
      title: 'Disclaimer',
      icon: <AlertTriangle className="h-5 w-5 mr-2" />,
      link: 'https://app.termly.io/policy-viewer/policy.html?policyUUID=4542d53e-543a-46ad-bfef-e2482a28e474'
    }
  ];

  return (
    <div className="container mx-auto py-10 px-4 min-h-screen">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-alex text-secondary mb-4">Policies</h1>
        <p className="text-lg font-playfair max-w-2xl mx-auto">
          Our terms, privacy policy, and other legal documents that govern your use of SoulSeer services.
        </p>
      </div>

      <Card className="max-w-4xl mx-auto cosmic-bg">
        <div className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4 w-full overflow-x-auto flex flex-nowrap justify-start sm:justify-center gap-2">
              {policyLinks.map((policy) => (
                <TabsTrigger 
                  key={policy.id} 
                  value={policy.id}
                  className="whitespace-nowrap flex items-center"
                >
                  {policy.icon}
                  <span className="hidden sm:inline">{policy.title}</span>
                  <span className="sm:hidden">{policy.title.split(' ')[0]}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {policyLinks.map((policy) => (
              <TabsContent 
                key={policy.id} 
                value={policy.id} 
                className="w-full"
              >
                <ScrollArea className="h-[500px] rounded-md border">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-3xl font-cinzel text-accent">{policy.title}</h2>
                      <a 
                        href={policy.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center text-secondary hover:text-accent-hover transition-colors"
                      >
                        Open <ExternalLink className="h-4 w-4 ml-1" />
                      </a>
                    </div>
                    <div className="text-light/80 text-center mt-10">
                      <p className="mb-4">View our full {policy.title} by clicking the button below:</p>
                      <a 
                        href={policy.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-6 py-3 bg-secondary hover:bg-accent text-background rounded-full transition-colors"
                      >
                        View Full {policy.title} <ExternalLink className="h-4 w-4 ml-2" />
                      </a>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </Card>
    </div>
  );
}