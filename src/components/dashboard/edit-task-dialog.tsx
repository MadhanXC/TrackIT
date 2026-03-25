'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  X,
  Loader2,
  Search,
  Save,
  Layout,
  FileText,
  Package,
  Calendar,
  Layers,
  User
} from 'lucide-react';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const GEOAPIFY_API_KEY = 'd83a3b59eb364a52a89040fa84473345';

const SURVEY_STATUS_OPTIONS = ['Scheduled', 'In Progress', 'Completed', 'On Hold'];
const PERMIT_STATUS_OPTIONS = ['Not Applied', 'Applied', 'In Review', 'Approved', 'Expired', 'Denied'];

const formSchema = z.object({
  workItemType: z.enum(['Job', 'Project']),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']),
  title: z.string().min(2, 'Title required'),
  street1: z.string().min(1, 'Address required'),
  pocName: z.string().min(1, 'POC contact info required'),
  description: z.string().min(5, 'Description required'),
  source: z.enum(['Call', 'Email', 'Text', 'In-person']).default('Call'),
  surveyRequired: z.boolean().default(false),
  surveyHandledBy: z.enum(['PLS', 'Others']).default('PLS'),
  surveyHandlerOthers: z.string().optional(),
  surveyStatus: z.string().default('Scheduled'),
  permitRequired: z.boolean().default(false),
  permitHandledBy: z.enum(['PLS', 'Others']).default('PLS'),
  permitHandlerOthers: z.string().optional(),
  permitStatus: z.string().default('Not Applied'),
  materialsRequired: z.boolean().default(false),
  materialsList: z.array(z.object({ name: z.string(), quantity: z.string() })).default([]),
  shipmentRequired: z.boolean().default(false),
  shipmentStatus: z.string().optional(),
  confirmationStatus: z.enum(['Pending', 'Confirmed']).default('Pending'),
  overallWorkStatus: z.string().default('Pending'),
  dateInitiated: z.string().optional(),
  dateCompleted: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function EditTaskDialog({ task, trigger, readOnly = false }: { task: any, trigger?: React.ReactNode, readOnly?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [isInputFocused, setIsInputFocused] = React.useState(false);
  
  const lastFetchedValueRef = React.useRef<string>(task.siteAddressStreet?.trim()?.toLowerCase() || '');
  const firestore = useFirestore();
  const { toast } = useToast();

  const isHandlerPLS = (handler: string) => handler === 'PLS';

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      workItemType: task.workItemType || 'Job',
      priority: task.priority || 'Medium',
      title: task.title || '',
      street1: task.siteAddressStreet || '',
      pocName: task.pocName || '',
      description: task.description || '',
      source: task.source || 'Call',
      surveyRequired: !!task.surveyRequired,
      surveyHandledBy: isHandlerPLS(task.surveyHandler) ? 'PLS' : 'Others',
      surveyHandlerOthers: isHandlerPLS(task.surveyHandler) ? '' : task.surveyHandler,
      surveyStatus: task.surveyStatus || 'Scheduled',
      permitRequired: !!task.permitRequired,
      permitHandledBy: isHandlerPLS(task.permitHandler) ? 'PLS' : 'Others',
      permitHandlerOthers: isHandlerPLS(task.permitHandler) ? '' : task.permitHandler,
      permitStatus: task.permitStatus || 'Not Applied',
      materialsRequired: !!task.materialsRequired,
      materialsList: task.materialsList || [],
      shipmentRequired: !!task.shipmentRequired,
      shipmentStatus: task.shipmentStatus || 'Pending',
      confirmationStatus: task.confirmationStatus || 'Pending',
      overallWorkStatus: task.overallWorkStatus || 'Pending',
      dateInitiated: task.dateInitiated || '',
      dateCompleted: task.dateCompleted || '',
    },
  });

  const { fields: materialFields, append: appendMaterial, remove: removeMaterial } = useFieldArray({ control: form.control, name: 'materialsList' });

  const street1Value = form.watch('street1');
  const surveyRequired = form.watch('surveyRequired');
  const permitRequired = form.watch('permitRequired');
  const materialsRequired = form.watch('materialsRequired');
  const shipmentRequired = form.watch('shipmentRequired');

  React.useEffect(() => {
    const fetchAddresses = async () => {
      const val = street1Value?.trim()?.toLowerCase() || '';
      if (readOnly || !isInputFocused || val.length < 5 || val === lastFetchedValueRef.current) return;
      setIsSearching(true);
      try {
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(val)}&filter=countrycode:us&apiKey=${GEOAPIFY_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        setSearchResults(data.features || []);
        setShowDropdown(true);
      } catch (e) { console.error(e); } finally { setIsSearching(false); }
    };
    const t = setTimeout(fetchAddresses, 800);
    return () => clearTimeout(t);
  }, [street1Value, readOnly, isInputFocused]);

  const handleSelectAddress = (f: any) => {
    const formatted = (f.properties.formatted || '').replace(/,?\s*(United States of America|United States)$/i, '');
    lastFetchedValueRef.current = formatted.trim().toLowerCase();
    form.setValue('street1', formatted, { shouldValidate: true });
    setShowDropdown(false);
  };

  async function onSubmit(values: FormValues) {
    if (!firestore || readOnly) return;
    setIsSubmitting(true);
    try {
      const finalSurveyHandler = values.surveyHandledBy === 'PLS' ? 'PLS' : values.surveyHandlerOthers || 'Others';
      const finalPermitHandler = values.permitHandledBy === 'PLS' ? 'PLS' : values.permitHandlerOthers || 'Others';
      const docRef = doc(firestore, 'workItems', task.id);
      updateDocumentNonBlocking(docRef, { 
        ...values, 
        siteAddressStreet: values.street1, 
        surveyHandler: values.surveyRequired ? finalSurveyHandler : 'N/A',
        permitHandler: values.permitRequired ? finalPermitHandler : 'N/A',
        overallWorkStatus: values.dateCompleted ? 'Completed' : values.overallWorkStatus, 
        updatedAt: new Date().toISOString() 
      });
      toast({ title: 'Success', description: `Changes updated.` });
      setOpen(false);
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message }); 
    } finally { 
      setIsSubmitting(false); 
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline" size="sm" className="rounded-none border-slate-950 font-bold">Modify</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto border-none shadow-2xl p-0 rounded-none bg-white">
        <DialogHeader className="p-4 md:p-6 border-b border-slate-200 flex flex-row items-center justify-between sticky top-0 bg-white z-20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-none bg-slate-950 flex items-center justify-center shrink-0">
              <Layout className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col text-left">
              <DialogTitle className="text-base md:text-lg font-bold text-slate-950 uppercase tracking-tight">
                {readOnly ? 'Entry Details' : `Modify ${form.watch('workItemType')}`}
              </DialogTitle>
              {!readOnly && <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entry: {task.id.slice(0, 8)}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 md:p-8">
          {readOnly ? (
            <div className="space-y-12">
              <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-950 leading-tight tracking-tight">{task.siteAddressStreet}</h1>
                <p className="text-lg md:text-xl font-bold text-slate-400">{task.title}</p>
              </div>
              <div className="bg-slate-50 p-6 border border-slate-100">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User className="h-3 w-3" /> Site POCs
                  </p>
                  <p className="text-sm font-bold text-slate-950 whitespace-pre-wrap">{task.pocName || 'No contact info provided'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-y border-slate-100 py-8">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</p>
                  <Badge variant="outline" className={cn("font-bold uppercase text-[10px] rounded-none border-none px-0", task.priority === 'Urgent' ? "text-red-600" : "text-slate-950")}>{task.priority}</Badge>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phase</p>
                  <p className="font-bold text-slate-950 uppercase text-[10px]">{task.overallWorkStatus}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</p>
                  <p className="font-bold text-slate-950 uppercase text-[10px]">{task.workItemType}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Source Channel</p>
                  <p className="font-bold text-slate-950 uppercase text-[10px]">{task.source}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Detailed Scope</h3>
                  </div>
                  <p className="text-sm font-medium text-slate-600 leading-relaxed bg-slate-50 p-6 border border-slate-100 whitespace-pre-wrap">{task.description || 'No detailed scope provided.'}</p>
                </div>
                <div className="space-y-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Operational Handlers</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 border border-slate-100 bg-white">
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Permit Status</p>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-950 uppercase">{task.permitRequired ? task.permitStatus : 'Not Required'}</span>
                          {task.permitRequired && <span className="text-[8px] text-primary font-bold uppercase mt-1">By: {task.permitHandler}</span>}
                        </div>
                      </div>
                      <div className="p-4 border border-slate-100 bg-white">
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Survey Status</p>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-950 uppercase">{task.surveyRequired ? task.surveyStatus : 'Not Required'}</span>
                          {task.surveyRequired && <span className="text-[8px] text-primary font-bold uppercase mt-1">By: {task.surveyHandler}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  {task.materialsRequired && task.materialsList?.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Material Inventory</h3>
                      </div>
                      <div className="border border-slate-100 divide-y divide-slate-50">
                        {task.materialsList.map((m: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-slate-50/30">
                            <span className="text-[10px] font-bold text-slate-900 uppercase">{m.name}</span>
                            <span className="text-[10px] font-bold text-primary uppercase">Qty: {m.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-950">Lifecycle Timeline</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 border border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Initiated</p>
                        <p className="text-[10px] font-bold text-slate-950">{task.dateInitiated || 'Not Commenced'}</p>
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Completed</p>
                        <p className="text-[10px] font-bold text-slate-950">{task.dateCompleted || 'In Pipeline'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <Button onClick={() => setOpen(false)} className="w-full font-bold h-14 bg-slate-950 text-white rounded-none uppercase text-xs tracking-widest">Return to Workspace</Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  <FormField 
                    control={form.control} 
                    name="workItemType" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Work Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-slate-300 font-bold h-11 rounded-none">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-none">
                            <SelectItem value="Job">Job</SelectItem>
                            <SelectItem value="Project">Project</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} 
                  />
                  <FormField 
                    control={form.control} 
                    name="priority" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-slate-300 font-bold h-11 rounded-none">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-none">
                            {['Low', 'Medium', 'High', 'Urgent'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} 
                  />
                  <FormField 
                    control={form.control} 
                    name="source" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Source</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-slate-300 font-bold h-11 rounded-none">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-none">
                            {['Call', 'Email', 'Text', 'In-person'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} 
                  />
                </div>

                <FormField 
                  control={form.control} 
                  name="pocName" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest flex items-center gap-2">
                        <User className="h-3 w-3" /> POCs
                      </FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter POC contact information..." className="border-slate-300 font-bold min-h-[80px] rounded-none resize-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} 
                />

                <FormField 
                  control={form.control} 
                  name="title" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Title</FormLabel>
                      <FormControl>
                        <Input className="border-slate-300 font-bold h-11 rounded-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} 
                />

                <div className="space-y-2 relative">
                  <FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Site Address</FormLabel>
                  <FormField 
                    control={form.control} 
                    name="street1" 
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input 
                              className="pl-10 border-slate-300 font-bold h-11 rounded-none" 
                              {...field} 
                              autoComplete="off" 
                              onFocus={() => setIsInputFocused(true)} 
                              onBlur={() => setTimeout(() => setIsInputFocused(false), 200)} 
                            />
                          </div>
                        </FormControl>
                        {showDropdown && searchResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 shadow-xl max-h-48 overflow-y-auto">
                            {searchResults.map((r, i) => (
                              <div 
                                key={i} 
                                className="px-4 py-2.5 text-[10px] hover:bg-slate-50 cursor-pointer font-bold border-b border-slate-100" 
                                onMouseDown={() => handleSelectAddress(r)}
                              >
                                {r.properties.formatted}
                              </div>
                            ))}
                          </div>
                        )}
                      </FormItem>
                    )} 
                  />
                </div>

                <FormField 
                  control={form.control} 
                  name="description" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Detailed Scope</FormLabel>
                      <FormControl>
                        <Textarea className="border-slate-300 font-medium min-h-[100px] resize-none rounded-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} 
                />

                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Operational Handlers</p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField 
                      control={form.control} 
                      name="surveyRequired" 
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none border-slate-400" />
                          </FormControl>
                          <FormLabel className="font-bold text-slate-950 text-[11px] uppercase cursor-pointer">Survey</FormLabel>
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={form.control} 
                      name="permitRequired" 
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none border-slate-400" />
                          </FormControl>
                          <FormLabel className="font-bold text-slate-950 text-[11px] uppercase cursor-pointer">Permit</FormLabel>
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={form.control} 
                      name="materialsRequired" 
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none border-slate-400" />
                          </FormControl>
                          <FormLabel className="font-bold text-slate-950 text-[11px] uppercase cursor-pointer">Materials</FormLabel>
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={form.control} 
                      name="shipmentRequired" 
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none border-slate-400" />
                          </FormControl>
                          <FormLabel className="font-bold text-slate-950 text-[11px] uppercase cursor-pointer">Shipment</FormLabel>
                        </FormItem>
                      )} 
                    />
                  </div>

                  {surveyRequired && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField 
                          control={form.control} 
                          name="surveyHandledBy" 
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[9px] font-bold uppercase">Handled By</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9 border-slate-300 rounded-none font-bold text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-none">
                                  <SelectItem value="PLS">PLS</SelectItem>
                                  <SelectItem value="Others">Others</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} 
                        />
                        <FormField 
                          control={form.control} 
                          name="surveyStatus" 
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[9px] font-bold uppercase">Survey Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9 border-slate-300 rounded-none font-bold text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-none">
                                  {SURVEY_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} 
                        />
                      </div>
                    </div>
                  )}

                  {permitRequired && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField 
                          control={form.control} 
                          name="permitHandledBy" 
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[9px] font-bold uppercase">Handled By</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9 border-slate-300 rounded-none font-bold text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-none">
                                  <SelectItem value="PLS">PLS</SelectItem>
                                  <SelectItem value="Others">Others</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} 
                        />
                        <FormField 
                          control={form.control} 
                          name="permitStatus" 
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[9px] font-bold uppercase">Permit Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9 border-slate-300 rounded-none font-bold text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-none">
                                  {PERMIT_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} 
                        />
                      </div>
                    </div>
                  )}

                  {materialsRequired && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-bold uppercase">Materials</p>
                        <Button type="button" variant="ghost" size="sm" onClick={() => appendMaterial({ name: '', quantity: '' })} className="h-6 text-[9px] uppercase font-bold text-primary">
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                      {materialFields.map((item, index) => (
                        <div key={item.id} className="flex gap-2">
                          <Input className="h-9 text-[10px] font-bold border-slate-300 rounded-none flex-1" placeholder="Item" {...form.register(`materialsList.${index}.name`)} />
                          <Input className="h-9 text-[10px] font-bold border-slate-300 rounded-none w-20" placeholder="Qty" {...form.register(`materialsList.${index}.quantity`)} />
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeMaterial(index)} className="h-9 w-9 text-destructive">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {shipmentRequired && (
                    <div className="animate-in fade-in slide-in-from-top-1">
                      <FormField 
                        control={form.control} 
                        name="shipmentStatus" 
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Logistics Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-10 border-slate-300 rounded-none font-bold text-[10px] uppercase bg-white">
                                  <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-none">
                                {['Pending', 'Shipped', 'In Transit', 'Delivered', 'Delayed'].map(s => <SelectItem key={s} value={s} className="text-[10px] uppercase font-bold">{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} 
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                  <FormField 
                    control={form.control} 
                    name="confirmationStatus" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Confirmation</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-slate-300 font-bold h-11 rounded-none">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-none">
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Confirmed">Confirmed</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} 
                  />
                  <FormField 
                    control={form.control} 
                    name="overallWorkStatus" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-slate-300 font-bold h-11 rounded-none">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-none">
                            {['Pending', 'In Progress', 'Completed', 'On Hold'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} 
                  />
                </div>
                <Button type="submit" className="w-full font-bold h-14 bg-slate-950 text-white rounded-none uppercase text-xs tracking-widest" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Update Changes
                </Button>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
