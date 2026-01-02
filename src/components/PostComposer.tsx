import { useState } from "react";
import { Lightbulb, GraduationCap, ShoppingCart, BadgeCheck, Plus, Mic, MicOff, Image, Sparkles, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ContentType = "inspire" | "educate" | "sell" | "proof";

interface Topic {
  id: string;
  name: string;
}

const contentTypes = [
  { id: "inspire" as ContentType, label: "Inspire", icon: Lightbulb },
  { id: "educate" as ContentType, label: "Educate", icon: GraduationCap },
  { id: "sell" as ContentType, label: "Sell", icon: ShoppingCart },
  { id: "proof" as ContentType, label: "Proof", icon: BadgeCheck },
];

export function PostComposer() {
  const [selectedType, setSelectedType] = useState<ContentType>("inspire");
  const [topics, setTopics] = useState<Topic[]>([
    { id: "1", name: "newyear2026" },
    { id: "2", name: "Rapidscoop" },
    { id: "3", name: "Epaphara" },
    { id: "4", name: "Tamil" },
  ]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const toggleTopic = (topicId: string) => {
    if (selectedTopics.includes(topicId)) {
      setSelectedTopics(selectedTopics.filter((id) => id !== topicId));
    } else if (selectedTopics.length < 2) {
      setSelectedTopics([...selectedTopics, topicId]);
    } else {
      toast.info("You can select up to 2 topics");
    }
  };

  const addTopic = () => {
    if (!newTopicName.trim()) {
      toast.error("Please enter a topic name");
      return;
    }
    const newTopic: Topic = {
      id: Date.now().toString(),
      name: newTopicName.trim(),
    };
    setTopics([...topics, newTopic]);
    setNewTopicName("");
    setIsAddTopicOpen(false);
    toast.success("Topic added successfully");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        
        // Here you would send the audio to a speech-to-text API
        toast.info("Processing audio...");
        
        // Simulating transcription for now
        setTimeout(() => {
          setContent((prev) => prev + " [Transcribed text would appear here]");
          toast.success("Audio transcribed successfully");
        }, 1500);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      toast.info("Recording started...");
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Could not access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleGenerateImage = () => {
    toast.info("Generate Image feature coming soon!");
  };

  const handleSurpriseMe = () => {
    toast.info("Surprise Me feature coming soon!");
  };

  return (
    <Card className="border-border/50 max-w-3xl mx-auto">
      <CardContent className="p-6 space-y-6">
        {/* Content Type Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-muted-foreground">Create as:</Label>
          <div className="grid grid-cols-4 gap-3">
            {contentTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`
                    flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all duration-200
                    ${isSelected 
                      ? "bg-foreground text-background border-foreground" 
                      : "bg-card border-border hover:border-foreground/50"
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Topics Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium text-muted-foreground">
                Your Topics <span className="text-xs">(select up to 2)</span>
              </Label>
            </div>
            <Dialog open={isAddTopicOpen} onOpenChange={setIsAddTopicOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Topic</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="topicName">Topic Name</Label>
                    <Input
                      id="topicName"
                      placeholder="Enter topic name"
                      value={newTopicName}
                      onChange={(e) => setNewTopicName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTopic()}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddTopicOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={addTopic}>Add Topic</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => {
              const isSelected = selectedTopics.includes(topic.id);
              return (
                <Badge
                  key={topic.id}
                  variant={isSelected ? "default" : "outline"}
                  className={`
                    cursor-pointer px-3 py-1.5 text-sm transition-all
                    ${isSelected 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-secondary"
                    }
                  `}
                  onClick={() => toggleTopic(topic.id)}
                >
                  <Link2 className="h-3 w-3 mr-1.5" />
                  {topic.name}
                </Badge>
              );
            })}
            <button
              onClick={() => setIsAddTopicOpen(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Text Input with Mic */}
        <div className="space-y-2">
          <div className="relative">
            <Textarea
              placeholder="What would you like to share?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px] pr-16 resize-none"
            />
            <Button
              size="icon"
              variant={isRecording ? "destructive" : "default"}
              className={`absolute right-3 top-3 rounded-full h-12 w-12 ${
                isRecording ? "animate-pulse" : ""
              }`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Type your idea or tap the mic to speak
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="default"
            className="bg-primary hover:bg-primary/90"
            onClick={handleGenerateImage}
          >
            <Image className="h-4 w-4 mr-2" />
            Generate Image
          </Button>
          <Button
            variant="secondary"
            className="bg-foreground text-background hover:bg-foreground/90"
            onClick={handleSurpriseMe}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Surprise Me
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
