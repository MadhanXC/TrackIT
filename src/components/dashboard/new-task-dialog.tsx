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
  Loader2,
  Search,
  X,
  PlusCircle,
} from 'lucide-react';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const GEOAPIFY_API_KEY = 'd83a3b59eb364a52a89040fa84473345';

const STATUS_OPTIONS = ['Pending', 'Applied', 'In Review', 'Approved', 'Expired'];

const formSchema = z.object({
  workItemType: z.enum(['Job', 'Project']),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']),
  title: z.string().min(2, 'Title required'),
  street1: z.string().min(1, 'Address required'),
  description: z.string().min(5, 'Description required'),
  source: z.enum(['Call', 'Email', 'Text', 'In-person']).default('Call'),
  surveyRequired: z.boolean().default(false),
  surveyHandledBy: z.enum(['PLS', 'Others']).default('PLS'),
  surveyExternalName: z.string().optional(),
  surveyStatus: z.string().default('Pending'),
  permitRequired: z.boolean().default(false),
  permitHandledBy: z.enum(['PLS', 'Others']).default('PLS'),
  permitExternalName: z.string().optional(),
  permitStatus: z.string().default('Pending'),
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

export function NewTaskDialog() {
  const [open, setOpen] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [isInputFocused, setIsInputFocused] = React.useState(false);
  
  const lastFetchedValueRef = React.useRef<string>('');
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      workItemType: 'Job',
      priority: 'Medium',
      title: '',
      street1: '',
      description: '',
      source: 'Call',
      surveyRequired: false,
      surveyHandledBy: 'PLS',
      surveyExternalName: '',
      surveyStatus: 'Pending',
      permitRequired: false,
      permitHandledBy: 'PLS',
      permitExternalName: '',
      permitStatus: 'Pending',
      materialsRequired: false,
      materialsList: [],
      shipmentRequired: false,
      shipmentStatus: 'Pending',
      confirmationStatus: 'Pending',
      overallWorkStatus: 'Pending',
      dateInitiated: '',
      dateCompleted: '',
    },
  });

  const { fields: materialFields, append: appendMaterial, remove: removeMaterial } = useFieldArray({ control: form.control, name: 'materialsList' });

  const workItemType = form.watch('workItemType');
  const street1Value = form.watch('street1');
  const surveyRequired = form.watch('surveyRequired');
  const surveyHandledBy = form.watch('surveyHandledBy');
  const permitRequired = form.watch('permitRequired');
  const permitHandledBy = form.watch('permitHandledBy');
  const materialsRequired = form.watch('materialsRequired');
  const shipmentRequired = form.watch('shipmentRequired');
  const confirmationStatus = form.watch('confirmationStatus');

  React.useEffect(() => {
    const fetchAddresses = async () => {
      const val = street1Value?.trim()?.toLowerCase() || '';
      if (!isInputFocused || val.length < 5 || val === lastFetchedValueRef.current) return;
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
  }, [street1Value, isInputFocused]);

  const handleSelectAddress = (f: any) => {
    const formatted = (f.properties.formatted || '').replace(/,?\s*(United States of America|United States)$/i, '');
    lastFetchedValueRef.current = formatted.trim().toLowerCase();
    form.setValue('street1', formatted, { shouldValidate: true });
    setShowDropdown(false);
  };

  async function onSubmit(values: FormValues) {
    if (!firestore) return;
    setIsSubmitting(true);
    try {
      const workItemsRef = doc(collection(firestore, 'workItems'));
      const surveyHandler = values.surveyRequired ? (values.surveyHandledBy === 'PLS' ? 'PLS' : (values.surveyExternalName || 'External')) : 'N/A';
      const permitHandler = values.permitRequired ? (values.permitHandledBy === 'PLS' ? 'PLS' : (values.permitExternalName || 'External')) : 'N/A';
      setDocumentNonBlocking(workItemsRef, { 
        ...values, 
        id: workItemsRef.id, 
        siteAddressStreet: values.street1, 
        surveyHandler, 
        permitHandler, 
        overallWorkStatus: values.dateCompleted ? 'Completed' : values.overallWorkStatus, 
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString() 
      }, { merge: true });
      toast({ title: 'Success', description: `New ${workItemType.toLowerCase()} created.` });
      setOpen(false);
      form.reset();
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message }); 
    } finally { 
      setIsSubmitting(false); 
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-bold bg-slate-950 text-white rounded-none hover:bg-slate-800 transition-all h-10 px-4 md:px-6 uppercase text-[10px] tracking-widest border-none shadow-none">
          <Plus className="h-4 w-4 mr-2" /> <span className="hidden sm:inline">New Project/Job</span><span className="sm:hidden">New</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto border-none shadow-2xl p-0 rounded-none bg-white">
        <DialogHeader className="p-4 md:p-6 border-b border-slate-200 flex flex-row items-center gap-3 sticky top-0 bg-white z-20">
          <div className="h-10 w-10 rounded-none bg-slate-950 flex items-center justify-center shrink-0"><PlusCircle className="h-5 w-5 text-white" /></div>
          <div className="flex flex-col text-left">
            <DialogTitle className="text-base md:text-lg font-bold text-slate-950 uppercase tracking-tight">Create {workItemType}</DialogTitle>
            <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Define parameters and requirements</DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-4 md:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                <FormField control={form.control} name="workItemType" render={({ field }) => (
                  <FormItem><FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Work Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="border-slate-300 font-bold h-11 rounded-none"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none"><SelectItem value="Job">Job</SelectItem><SelectItem value="Project">Project</SelectItem></SelectContent></Select></FormItem>
                )} />
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem><FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Priority</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="border-slate-300 font-bold h-11 rounded-none"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none">{['Low', 'Medium', 'High', 'Urgent'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></FormItem>
                )} />
                <FormField control={form.control} name="source" render={({ field }) => (
                  <FormItem><FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Source</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="border-slate-300 font-bold h-11 rounded-none"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none">{['Call', 'Email', 'Text', 'In-person'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Title</FormLabel><FormControl><Input placeholder="Internal reference..." className="border-slate-300 font-bold h-11 rounded-none" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="space-y-2 relative">
                <FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Site Address</FormLabel>
                <FormField control={form.control} name="street1" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input placeholder="Search location..." className="pl-10 border-slate-300 font-bold h-11 rounded-none" {...field} autoComplete="off" onFocus={() => setIsInputFocused(true)} onBlur={() => setTimeout(() => setIsInputFocused(false), 200)} />
                      </div>
                    </FormControl>
                    {showDropdown && searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 shadow-xl max-h-48 overflow-y-auto">
                        {searchResults.map((r, i) => (<div key={i} className="px-4 py-2.5 text-[10px] hover:bg-slate-50 cursor-pointer font-bold border-b border-slate-100" onMouseDown={() => handleSelectAddress(r)}>{r.properties.formatted}</div>))}
                      </div>
                    )}
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Detailed Scope</FormLabel><FormControl><Textarea className="border-slate-300 font-medium min-h-[100px] resize-none rounded-none" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Requirements</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField control={form.control} name="surveyRequired" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none border-slate-400" /></FormControl><FormLabel className="font-bold text-slate-950 text-[11px] uppercase cursor-pointer">Survey</FormLabel></FormItem>)} />
                  <FormField control={form.control} name="permitRequired" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none border-slate-400" /></FormControl><FormLabel className="font-bold text-slate-950 text-[11px] uppercase cursor-pointer">Permit</FormLabel></FormItem>)} />
                  <FormField control={form.control} name="materialsRequired" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none border-slate-400" /></FormControl><FormLabel className="font-bold text-slate-950 text-[11px] uppercase cursor-pointer">Materials</FormLabel></FormItem>)} />
                  <FormField control={form.control} name="shipmentRequired" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none border-slate-400" /></FormControl><FormLabel className="font-bold text-slate-950 text-[11px] uppercase cursor-pointer">Shipment</FormLabel></FormItem>)} />
                </div>

                {surveyRequired && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-1">
                    <FormField control={form.control} name="surveyHandledBy" render={({ field }) => (
                      <FormItem><FormLabel className="text-[9px] font-bold uppercase text-slate-500">Survey Handler</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-9 border-slate-300 rounded-none font-bold text-[10px]"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none"><SelectItem value="PLS">PLS</SelectItem><SelectItem value="Others">Others</SelectItem></SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="surveyStatus" render={({ field }) => (
                      <FormItem><FormLabel className="text-[9px] font-bold uppercase text-slate-500">Survey Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-9 border-slate-300 rounded-none font-bold text-[10px]"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none">{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                    {surveyHandledBy === 'Others' && (
                      <FormField control={form.control} name="surveyExternalName" render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-bold uppercase text-slate-500">External Name</FormLabel><FormControl><Input className="h-9 border-slate-300 rounded-none font-bold text-[10px]" {...field} /></FormControl></FormItem>)} />
                    )}
                  </div>
                )}

                {permitRequired && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-1">
                    <FormField control={form.control} name="permitHandledBy" render={({ field }) => (
                      <FormItem><FormLabel className="text-[9px] font-bold uppercase text-slate-500">Permit Handler</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-9 border-slate-300 rounded-none font-bold text-[10px]"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none"><SelectItem value="PLS">PLS</SelectItem><SelectItem value="Others">Others</SelectItem></SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="permitStatus" render={({ field }) => (
                      <FormItem><FormLabel className="text-[9px] font-bold uppercase text-slate-500">Permit Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-9 border-slate-300 rounded-none font-bold text-[10px]"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none">{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                    {permitHandledBy === 'Others' && (
                      <FormField control={form.control} name="permitExternalName" render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-bold uppercase text-slate-500">External Name</FormLabel><FormControl><Input className="h-9 border-slate-300 rounded-none font-bold text-[10px]" {...field} /></FormControl></FormItem>)} />
                    )}
                  </div>
                )}

                {materialsRequired && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase text-slate-500">Materials</p><Button type="button" variant="ghost" size="sm" onClick={() => appendMaterial({ name: '', quantity: '' })} className="h-6 text-[9px] uppercase font-bold text-primary"><Plus className="h-3 w-3 mr-1" /> Add</Button></div>
                    {materialFields.map((item, index) => (
                      <div key={item.id} className="flex gap-2">
                        <Input className="h-9 text-[10px] font-bold border-slate-300 rounded-none flex-1" placeholder="Item" {...form.register(`materialsList.${index}.name`)} />
                        <Input className="h-9 text-[10px] font-bold border-slate-300 rounded-none w-20" placeholder="Qty" {...form.register(`materialsList.${index}.quantity`)} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeMaterial(index)} className="h-9 w-9 text-destructive"><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}

                {shipmentRequired && (
                  <div className="animate-in fade-in slide-in-from-top-1">
                    <FormField control={form.control} name="shipmentStatus" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Shipment Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-10 border-slate-300 rounded-none font-bold text-[10px] uppercase bg-white">
                              <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-none">
                            {['Pending', 'Shipped', 'In Transit', 'Delivered', 'Delayed'].map(s => (
                              <SelectItem key={s} value={s} className="text-[10px] uppercase font-bold">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                <FormField control={form.control} name="confirmationStatus" render={({ field }) => (
                  <FormItem><FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Confirmation Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="border-slate-300 font-bold h-11 rounded-none"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none"><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Confirmed">Confirmed</SelectItem></SelectContent></Select></FormItem>
                )} />
                <FormField control={form.control} name="overallWorkStatus" render={({ field }) => (
                  <FormItem><FormLabel className="text-slate-950 font-bold uppercase text-[9px] tracking-widest">Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="border-slate-300 font-bold h-11 rounded-none"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none">{['Pending', 'In Progress', 'Completed', 'On Hold'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></FormItem>
                )} />
              </div>
              {confirmationStatus === 'Confirmed' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 bg-slate-50 border border-slate-200 rounded-none animate-in fade-in slide-in-from-top-1">
                  <FormField control={form.control} name="dateInitiated" render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-bold uppercase text-slate-500">Initiation Date</FormLabel><FormControl><Input type="date" className="h-10 text-[10px] font-bold border-slate-300 rounded-none bg-white" {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="dateCompleted" render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-bold uppercase text-slate-500">Completion Date</FormLabel><FormControl><Input type="date" className="h-10 text-[10px] font-bold border-slate-300 rounded-none bg-white" {...field} /></FormControl></FormItem>)} />
                </div>
              )}
              <Button type="submit" className="w-full font-bold h-14 bg-slate-950 text-white rounded-none uppercase text-xs tracking-widest" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin mr-2" /> : `Create ${workItemType}`}</Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}