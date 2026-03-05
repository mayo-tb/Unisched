from django.db import migrations, models
import uuid

class Migration(migrations.Migration):

    dependencies = [
        ('scheduling', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='TaskTracker',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('task_id', models.CharField(blank=True, help_text='Django-Q2 task ID', max_length=255, null=True)),
                ('status', models.CharField(choices=[('PENDING', 'Pending'), ('RUNNING', 'Running'), ('COMPLETED', 'Completed'), ('FAILED', 'Failed')], default='PENDING', max_length=20)),
                ('progress', models.IntegerField(default=0, help_text='0-100 percentage')),
                ('current_generation', models.IntegerField(default=0)),
                ('current_fitness', models.FloatField(default=0.0)),
                ('result', models.JSONField(blank=True, help_text='Final result payload (if successful)', null=True)),
                ('error_message', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('workspace', models.ForeignKey(on_delete=models.CASCADE, related_name='tasks', to='scheduling.workspace')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
